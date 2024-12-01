import { Client, ClientOptions, Collection, Interaction, Message, REST, Routes } from "discord.js";
import { CommandOption, ExtractArgsFromOptions, OptionType } from "../types/CommandTypings";
import HarmonyLogger from "../types/HarmonyLogger";
import OptionParser from "./OptionParser";
import { PromiseUtil } from "sussy-util";
import { readdirSync } from "node:fs";
import Command from "./Command";
import Interop from "./Interop";

type HarmonyClientOptions<T extends boolean = boolean> = ClientOptions & {
    allowTextCommands?: T;
    reloadCommandsOnStartUp?: boolean;
    logger?: HarmonyLogger;
} & (T extends true ? { prefix: string } : { prefix?: never });


/**
 * Custom Discord.js Client for handling commands and interactions.
 * @template T - Indicates whether text commands are allowed.
 */
export default class HarmonyClient<
    T extends boolean = boolean,
    Ready extends boolean = boolean
> extends Client<Ready> {
    public readonly cooldowns = new Collection<string, Collection<string, number>>();
    public readonly commands = new Collection<string, Command<any>>();
    public readonly prefix: T extends true ? string : undefined;
    private readonly logger?: HarmonyLogger;

    /**
     * Initializes the HarmonyClient instance.
     * @param options - Options to configure the client, including whether text commands are allowed.
     */
    public constructor(options: HarmonyClientOptions<T>) {
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
     * Handles slash command interactions.
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
            this.logger?.error('Argument parsing error', {
                commandName: name,
                userId: interaction.user.id,
                error,
            });

            this.emit('argumentParsingError', { interop, error });
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
            this.logger?.error('Argument parsing error for text command', {
                commandName,
                userId: message.author.id,
                error,
            });

            this.emit('argumentParsingError', { error, interop });
            return;
        }

        this.commandHandler(command, interop, resolvedArgs);
    }

    /**
     * Executes a command after validation and handling of permissions, cooldowns, and errors.
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
    }

    /**
     * Dynamically loads commands into the client's command collection.
     * @param commands - The commands to load.
     */
    public loadCommands(commands: Command<any>[]) {
        commands.forEach((command) => this.commands.set(command.name, command));
    }

    public loadCommandsFolder(path: string) {
        const files = readdirSync(path);

        const commands = files
            .map(e => require(`${path}/${e}`))
            .map(e => e.default ?? e)
            .filter(e => e instanceof Command);

        this.loadCommands(commands);
    }

    public async reloadCommands(): Promise<number> {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!!);
        const commands = this.commands.map(e => e.slashCommandConfig.toJSON());
        return (await rest.put(Routes.applicationCommands(this.user!.id), { body: commands }) as Array<unknown>).length;
    }
}
