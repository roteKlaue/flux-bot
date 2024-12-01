import { Client, ClientOptions, Collection, Interaction, Message, REST, Routes } from "discord.js";
import { CommandOption, ExtractArgsFromOptions, OptionType } from "../types/CommandTypings";
import { Middleware, MiddlewareContext } from "../types/FluxMiddleware";
import FluxLogger from "../types/FluxLogger";
import OptionParser from "./OptionParser";
import { PromiseUtil } from "sussy-util";
import { readdirSync } from "node:fs";
import Command from "./Command";
import Interop from "./Interop";

type FluxClientOptions<T extends boolean = boolean> = ClientOptions & {
    allowTextCommands?: T;
    reloadCommandsOnStartUp?: boolean;
    logger?: FluxLogger;
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
    public readonly prefix: T extends true ? string : undefined;
    private readonly logger?: FluxLogger;

    public readonly preExecutionMiddleware: Middleware[] = [];
    public readonly postExecutionMiddleware: Middleware[] = [];

    /**
     * Initializes the FluxClient instance.
     * @param options - Configuration options for the client.
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
    }

    /**
     * Handles slash command interactions from Discord.
     * @param interaction - The Discord interaction to process.
     */
    private async handleInteraction(interaction: Interaction) {
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
        const [args, error] = await PromiseUtil.handler(OptionParser.parseOptions(command.options ?? [], interaction, interop));

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

        const context = { command, args, interop, client: this };

        let preExecutionPassed = true;
        try {
            preExecutionPassed = await this.executeMiddleware(this.preExecutionMiddleware, context);
        } catch (err) {
            this.logger?.error('Pre-execution middleware error', { command: command.name, error: err });
            this.emit('middlewareError', { command, interop, error: err });
            return;
        }

        if (!preExecutionPassed) {
            this.logger?.warn('Middleware blocked command execution', { command: command.name });
            return;
        }

        try {
            await command.execute(this, interop, args);
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
        let continueExecution = true;

        const next = async () => {
            index++;
            if (index < middleware.length) {
                try {
                    await middleware[index](context, next);
                } catch (err) {
                    continueExecution = false;
                    throw err;
                }
            }
        };

        try {
            await next();
        } catch {
            continueExecution = false;
        }

        return continueExecution;
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
        commands.forEach((command) => this.commands.set(command.name, command));
    }

    /**
     * Loads command files from a specified folder.
     * @param path - The path to the folder containing command files.
     */
    public loadCommandsFolder(path: string) {
        const files = readdirSync(path);

        const commands = files
            .map(e => require(`${path}/${e}`))
            .map(e => e.default ?? e)
            .filter(e => e instanceof Command);

        this.loadCommands(commands);
    }

    /**
     * Reloads all commands and updates Discord with the latest slash command configurations.
     * @returns The number of commands reloaded.
     */
    public async reloadCommands(): Promise<number> {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!!);
        const commands = this.commands.map(e => e.slashCommandConfig.toJSON());
        return (await rest.put(Routes.applicationCommands(this.user!.id), { body: commands }) as Array<unknown>).length;
    }
}
