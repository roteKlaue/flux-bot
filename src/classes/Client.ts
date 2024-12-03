import { Client, ClientOptions, Collection, Interaction, Message, REST, Routes } from "discord.js";
import { CommandOption, ExtractArgsFromOptions, OptionType } from "../types/CommandTypings";
import { Middleware, MiddlewareContext } from "../types/FluxMiddleware";
import { ArgumentError } from "./errors/ArgumentError";
import { readdirSync, lstatSync } from "node:fs";
import { Plugin } from "../types/FluxPlugin";
import FluxLogger from "../types/FluxLogger";
import OptionParser from "./OptionParser";
import { PromiseUtil } from "sussy-util";
import Command from "./Command";
import Interop from "./Interop";
import PluginManager from "./PluginManager";

type FluxClientOptions<T extends boolean = boolean> = ClientOptions & {
    allowTextCommands?: T;
    reloadCommandsOnStartUp?: boolean;
    logger?: FluxLogger;
    plugins?: Plugin[] | string;
} & (T extends true ? { prefix: string } : { prefix?: never });


/**
 * Custom Discord.js Client for handling commands and interactions.
 * @template T - Indicates whether text commands are allowed.
 */
export default class FluxClient<
    T extends boolean = boolean,
> extends Client {
    public readonly cooldowns = new Collection<string, Collection<string, number>>();
    public readonly commands = new Collection<string, Command<any>>();
    public readonly plugins = new Collection<string, Plugin>();
    public readonly prefix: T extends true ? string : undefined;
    public readonly logger?: FluxLogger;

    public readonly preExecutionMiddleware: Middleware[] = [];
    public readonly postExecutionMiddleware: Middleware[] = [];
    public readonly pluginManager = new PluginManager(this);

    /**
     * Initializes the FluxClient instance.
     * @param options - Configuration options for the client.s
     */
    public constructor(options: FluxClientOptions<T>) {
        super(options);

        this.logger = options.logger;
        if (options.allowTextCommands) {
            this.prefix = options.prefix as T extends true ? string : undefined;
            this.on("messageCreate", this.handleMessageInteraction.bind(this));
        } else {
            this.prefix = void 0 as T extends true ? string : undefined;
        }
        this.on("interactionCreate", this.handleInteraction.bind(this));

        if (options.reloadCommandsOnStartUp) {
            this.once("ready", this.reloadCommands.bind(this));
        }

        if (options.plugins) {
            this.pluginManager.loadPlugins(options.plugins);
        }
    }

    /**
     * Registers a plugin with the client.
     * @param plugin - The plugin to register.
     * @returns True if the plugin was successfully registered, false if already registered.
     */
    public registerPlugin(plugin: Plugin): boolean {
        if (this.plugins.has(plugin.name)) {
            this.logger?.warn(`Plugin already registered: ${plugin.name}`);
            return false;
        }

        this.plugins.set(plugin.name, plugin);
        this.logger?.info(`Plugin registered: ${plugin.name} (v${plugin.version})`);
        return true;
    }

    /**
     * Unregisters a plugin from the client.
     * @param pluginName - The name of the plugin to unregister.
     * @returns True if the plugin was successfully unregistered, false if not found.
     */
    public unregisterPlugin(pluginName: string): boolean {
        if (!this.plugins.has(pluginName)) {
            this.logger?.warn(`Plugin not found: ${pluginName}`);
            return false;
        }

        this.plugins.delete(pluginName);
        this.logger?.info(`Plugin unregistered: ${pluginName}`);
        return true;
    }

    /**
     * Retrieves a plugin by name.
     * @param pluginName - The name of the plugin.
     * @returns The plugin instance or undefined if not found.
     */
    public getPlugin(pluginName: string): Plugin | undefined {
        return this.plugins.get(pluginName);
    }

    /**
     * Handles interactions and delegates to plugins with interaction-specific hooks.
     * @param interaction - The interaction event.
     */
    private async handlePluginInteraction(interaction: Interaction) {
        for (const plugin of this.plugins.values()) {
            try {
                if (interaction.isCommand() && plugin.onCommandInteraction) {
                    await plugin.onCommandInteraction(interaction);
                } else if (interaction.isAnySelectMenu() && plugin.onMenuInteraction) {
                    await plugin.onMenuInteraction(interaction);
                } else if (interaction.isButton() && plugin.onButtonInteraction) {
                    await plugin.onButtonInteraction(interaction);
                }
                await plugin.onInteraction?.(interaction);
            } catch (error) {
                this.emit("pluginError", { plugin, error })
                this.logger?.error(`Plugin failed to handle interaction: ${plugin.name}`, { error });
            }
        }
    }

    /**
     * Handles incoming messages and delegates to plugins with `onMessage` hooks.
     * @param message - The message event.
     */
    private async handlePluginMessage(message: Message) {
        for (const plugin of this.plugins.values()) {
            try {
                await plugin.onMessage?.(message);
            } catch (error) {
                this.emit("pluginError", { plugin, error })
                this.logger?.error(`Plugin failed to handle message: ${plugin.name}`, { error });
            }
        }
    }

    private async handlePluginCommand(interop: Interop) {
        for (const plugin of this.plugins.values()) {
            try {
                await plugin.onCommandCall?.(interop);
            } catch (error) {
                this.emit("pluginError", { plugin, error })
                this.logger?.error(`Plugin failed to handle interop call: ${plugin.name}`, { error });
            }
        }
    }

    /**
     * Handles slash command interactions from Discord.
     * @param interaction - The Discord interaction to process.
     */
    private async handleInteraction(interaction: Interaction) {
        await this.handlePluginInteraction(interaction);
        if (!interaction.isCommand()) return;

        const name = interaction.commandName;
        const command = this.commands.get(name);

        if (!command) {
            this.logger?.warn('Unknown command attempted', {
                commandName: name,
                userId: interaction.user.id,
                guildId: interaction.guild?.id,
            });

            this.emit('commandNotFound', { interaction, name });
            return;
        }

        await interaction.deferReply({ ephemeral: command.private ?? false });

        const interop = new Interop(interaction, command.private ?? false);
        const [args, error] = await PromiseUtil.handler<ExtractArgsFromOptions<any>, ArgumentError>(OptionParser.parseOptions(command.options ?? [], interaction, interop));

        if (error || !args) {
            this.logger?.info('Invalid arguments given for interaction', {
                commandName: name,
                userId: interaction.user.id,
                error,
            });

            this.emit('invalidArgumentsGiven', { interop, error });
            return;
        }

        this.commandHandler(command, interop, args);
    }

    /**
     * Handles message-based commands for text commands.
     * @param message - The message to process.
     */
    private async handleMessageInteraction(message: Message) {
        if (
            !this.prefix ||
            message.author.bot ||
            !message.content.trim().startsWith(this.prefix)
        )
            return;

        const args = message.content.slice(this.prefix.length)
            .trim()
            .split(/\s+/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        const command = this.commands.get(commandName)
            || this.commands.find(cmd => cmd.aliases?.includes(commandName));

        if (!command) return;

        if (command.private) {
            message.delete();
        }

        if (!message.guild && command.inDM) {
            this.logger?.warn('Invalid context for command', {
                commandName,
                userId: message.author.id,
            });

            this.emit('invalidContext', { message, command });
            return;
        }

        await this.handlePluginMessage(message);

        const interop = new Interop(message, command.private ?? false);
        const [resolvedArgs, error] = await PromiseUtil.handler(OptionParser.parseOptions(command.options ?? [], message, interop, args));

        if (error || !resolvedArgs) {
            this.logger?.info('Invalid arguments given for text command', {
                commandName,
                userId: message.author.id,
                error,
            });

            this.emit('invalidArgumentsGiven', { error, interop });
            return;
        }

        this.commandHandler(command, interop, resolvedArgs);
    }

    /**
     * Executes a command after middleware, validation and handling of permissions, cooldowns, and errors.
     * @param command - The command to execute.
     * @param interop - The interop object representing the interaction or message.
     * @param args - The parsed arguments for the command.
     */
    private async commandHandler<T extends CommandOption<OptionType>[]>(
        command: Command<T>,
        interop: Interop,
        args: ExtractArgsFromOptions<T>
    ) {
        if (command.permissions && !interop.member?.permissions.has(command.permissions)) {
            this.logger?.warn('Permission denied', {
                commandName: command.name,
                userId: interop.user.id,
                guildId: interop.guild?.id,
            });
            this.emit('permissionDenied', { command, interop });
            return;
        }

        if (command.cooldown) {
            const current = Date.now();
            const timeStamps = this.cooldowns.get(command.name)
                || this.cooldowns.set(command.name, new Collection()).get(command.name)!!;
            const cooldownTime = (command.cooldown) * 1000;

            const lastuse = timeStamps.get(interop.user.id);
            if (lastuse && current < lastuse + cooldownTime) {
                const timeLeft = (lastuse + cooldownTime - current) / 1000;

                this.logger?.info('Cooldown active', {
                    commandName: command.name,
                    userId: interop.user.id,
                    timeLeft,
                });

                this.emit('cooldownActive', { command, interop, timeLeft });
            }

            timeStamps.set(interop.user.id, current);
            setTimeout(() => timeStamps.delete(interop.user.id), cooldownTime);
        }
        
        let pluginArgs: Record<string, any> = {};
        for (const plugin of this.plugins.values()) {
            try {
                const extraArgs = await plugin.provideCommandArguments?.(interop, command);
                if (extraArgs) {
                    pluginArgs[plugin.name] = extraArgs;
                }
            } catch (error) {
                this.logger?.error(`Plugin failed to provide arguments: ${plugin.name}`, { error });
                this.emit('pluginError', { plugin, error });
            }
        }

        const context = { command, args, interop, client: this, pluginArgs };
        
        try {
            await this.executeMiddleware([...this.preExecutionMiddleware, this.postPreExecution], context);
        } catch (err) {
            this.logger?.error('Pre-execution middleware error', { command: command.name, error: err });
            this.emit('middlewareError', { command, interop, error: err });
            return;
        }
    }

    private async postPreExecution<T extends CommandOption<OptionType>[]>(context: MiddlewareContext & { pluginArgs?: Record<string, any> }) {
        const { command, interop, args, pluginArgs } = context;
        await this.handlePluginCommand(interop);

        try {
            await command.execute(this, interop, args as ExtractArgsFromOptions<T>, pluginArgs);
        } catch (err) {
            this.logger?.error('Command execution error', {
                commandName: command.name,
                userId: interop.user.id,
                guildId: interop.guild?.id,
                error: err,
            });
            this.emit('commandExecutionError', { command, interop, error: err });
        }

        try {
            await this.executeMiddleware(this.postExecutionMiddleware, context);
        } catch (err) {
            this.logger?.error('Post-execution middleware error', { command: command.name, error: err });
            this.emit('middlewareError', { command, interop, error: err });
        }
    }

    /**
     * Executes a list of middleware functions sequentially.
     * @param middleware - The list of middleware functions to execute.
     * @param context - The middleware context to pass.
     * @returns Whether execution passed all middleware.
     */
    private async executeMiddleware(middleware: Middleware[], context: MiddlewareContext) {
        let index = -1;

        const next = async () => {
            index++;
            if (index < middleware.length) {
                try {
                    await middleware[index](context, next);
                } catch (err) {
                    throw err;
                }
            }
        };

        await next();
    }

    /**
     * Registers a pre-execution middleware function.
     * @param middleware - The middleware function to register.
     */
    public registerPreExecutionMiddleware(middleware: Middleware): void {
        this.preExecutionMiddleware.push(middleware);
    }

    /**
     * Registers a post-execution middleware function.
     * @param middleware - The middleware function to register.
     */
    public registerPostExecutionMiddleware(middleware: Middleware): void {
        this.postExecutionMiddleware.push(middleware);
    }

    /**
     * Dynamically loads commands into the client's command collection.
     * @param commands - The commands to load.
     */
    public loadCommands(commands: Command<any>[]) {
        commands.forEach((command) => {
            if (
                this.commands.has(command.name) ||
                command.aliases?.some(alias => this.commands.some(cmd => cmd.name === alias || cmd.aliases?.includes(alias)))
            ) {
                this.logger?.warn("Command Name | Aliases overlap", { command, name: command.name, aliases: command.aliases });
            }
            this.commands.set(command.name, command);
        });
    }

    /**
     * Loads command files from a specified folder.
     * @param path - The path to the folder containing command files.
     */
    public loadCommandsFolder(path: string) {
        const files = readdirSync(path);

        const commands = files
            .filter(e => lstatSync(`${path}/${e}`).isFile())
            .filter(file => file.endsWith(".js"))
            .map(file => require(`${path}/${file}`))
            .map(module => module.default ?? module)
            .filter(command => command instanceof Command);

        this.loadCommands(commands);
    }

    /**
     * Reloads all commands and updates Discord with the latest slash command configurations.
     * @returns The number of commands reloaded.
     */
    public async reloadCommands(): Promise<number> {
        if (!this.isReady()) {
            this.logger?.warn('Client is not ready, aborting command reload.');
            return 0;
        }

        const rest = new REST({ version: '10' }).setToken(this.token!!);
        const commands = this.commands.map(e => e.slashCommandConfig.toJSON());
        return (await rest.put(Routes.applicationCommands(this.user!.id), { body: commands }) as Array<unknown>).length;
    }
}
