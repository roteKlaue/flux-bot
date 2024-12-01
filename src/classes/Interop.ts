import { Channel, CommandInteraction, EmbedBuilder, Message, User, APIActionRowComponent, APIMessageActionRowComponent, Guild, GuildMember } from "discord.js";

type MessagePayload = string | {
    content?: string;
    embeds?: EmbedBuilder[];
    components?: APIActionRowComponent<APIMessageActionRowComponent>[];
};

/**
 * Interface for unified interaction handling between CommandInteraction and Message.
 */
export interface IInterop<Private extends boolean = boolean> {
    readonly member: GuildMember | undefined;
    readonly channel: Channel | null;
    readonly guild: Guild | null;
    readonly createdAt: Date;
    readonly user: User;

    readonly delete: Private extends true ? () => void : never;
    followUp(content: MessagePayload): Promise<Interop<Private>>;
}

/**
 * A class providing a unified interface for handling Discord CommandInteractions and Messages.
 * Allows actions like sending follow-ups and deleting responses, abstracting the differences
 * between interaction-based and message-based commands.
 * @template T - Indicates whether the interaction is private.
 */
export default class Interop<T extends boolean = boolean> implements IInterop {
    private readonly replyFunction: (content: MessagePayload) => Promise<Message>;
    private readonly deleterFunction: () => Promise<void>;

    public readonly member: GuildMember | undefined;
    public readonly channel: Channel | null;
    public readonly guild: Guild | null;
    public readonly createdAt: Date;
    public readonly user: User;

    /**
     * Initializes an Interop instance.
     * @param base - The base CommandInteraction or Message to wrap.
     * @param isPrivate - Indicates whether this interaction is private.
     * @throws {TypeError} If the base is not a CommandInteraction or Message.
     */
    public constructor(base: CommandInteraction | Message<boolean>, private readonly isPrivate: T) {
        if (!(base instanceof CommandInteraction || base instanceof Message)) {
            throw new TypeError("Interop expects CommandInteraction or Message as base.");
        }

        this.channel = base.channel;
        this.user = Interop.isMessage(base)
            ? base.author
            : base.user ?? base.member?.user;

        this.guild = base.guild;
        this.createdAt = base.createdAt;
        this.member = base.guild?.members.cache.get(this.user.id);

        this.replyFunction = Interop.isCommandInteraction(base)
            ? base.followUp.bind(base)
            : isPrivate
                ? base.author.send.bind(base.author)
                : base.reply.bind(base);

        this.deleterFunction = Interop.isCommandInteraction(base)
            ? base.deleteReply.bind(base)
            : () => base.delete()
                .then(() => Promise.resolve())
                .catch(err => Promise.reject(new Error(`Failed to delete message: ${err.message}`)));
    }

    /**
     * Deletes the associated interaction or message.
     * @returns A promise resolving when the deletion is complete.
     * @throws {Error} If delete is called on a private interaction.
     */
    public delete(): Promise<void> {
        if (this.isPrivate) {
            throw new Error("Delete is not available for private messages.");
        }
        return this.deleterFunction();
    }

    /**
     * Sends a follow-up message or response.
     * @param content - The content of the follow-up message, which can include text, embeds, or components.
     * @returns A promise resolving to a new Interop instance representing the follow-up message.
     */
    async followUp(content: MessagePayload): Promise<Interop<T>> {
        return new Interop(await this.replyFunction(content), this.isPrivate);
    }

    /**
     * Type guard for checking if a given base object is a CommandInteraction.
     * @param base - The object to check.
     * @returns True if the base is a CommandInteraction, false otherwise.
     */
    private static isCommandInteraction(base: any): base is CommandInteraction {
        return base instanceof CommandInteraction;
    }

    /**
     * Type guard for checking if a given base object is a Message.
     * @param base - The object to check.
     * @returns True if the base is a Message, false otherwise.
     */
    private static isMessage(base: any): base is Message {
        return base instanceof Message;
    }
}
