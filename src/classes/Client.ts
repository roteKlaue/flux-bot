import { CommandOption, ExtractArgsFromOptions, OptionType } from "../types/CommandTypings";
import { Client, ClientOptions, Collection, Interaction, Message } from "discord.js";
import OptionParser from "./OptionParser";
import { PromiseUtil } from "sussy-util";
import Command from "./Command";
import Interop from "./Interop";

type HarmonyClientOptions<T extends boolean = boolean> = ClientOptions & {
    allow_text_commands: T;
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

    /**
     * Initializes the HarmonyClient instance.
     * @param options - Options to configure the client, including whether text commands are allowed.
     */
    public constructor(options: HarmonyClientOptions<T>) {
        super(options);

        if (options.allow_text_commands) {
            this.prefix = options.prefix as T extends true ? string : undefined;
            this.on("messageCreate", this.handleMessageInteraction.bind(this));
        } else {
            this.prefix = void 0 as T extends true ? string : undefined;
        }
        this.on("interactionCreate", this.handleInteraction.bind(this));
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
            this.emit('commandNotFound', { interaction, name });
            return;
        }

        await interaction.deferReply({ ephemeral: command.private ?? false });

        const interop = new Interop(interaction, command.private ?? false);
        const [args, error] = await PromiseUtil.handler(OptionParser.parseOptions(command.options ?? [], interaction, interop));

        if (error || !args) {
            this.emit('argumentParsingError', { interaction, error });
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

        const command = this.commands.get(commandName);
        if (!command) return;

        if (command.private) {
            message.delete();
        }

        const interop = new Interop(message, command.private ?? false);
        const [resolvedArgs, error] = await PromiseUtil.handler(OptionParser.parseOptions(command.options ?? [], message, interop, args));

        if (error || !resolvedArgs) {
            this.emit('argumentParsingError', { message, error });
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
                this.emit('cooldownActive', { command, interop, timeLeft });
            }

            timeStamps.set(interop.user.id, current);
            setTimeout(() => timeStamps.delete(interop.user.id), cooldownTime);
        }


        try {
            await command.execute(this, interop, args);
        } catch (err) {
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
}
