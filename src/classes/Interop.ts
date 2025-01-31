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
    readonly base: CommandInteraction | Message;
    readonly member: GuildMember | undefined;
    readonly channel: Channel | null;
    readonly guild: Guild | null;
    readonly isPrivate: Private;
    readonly createdAt: Date;
    readonly user: User;

    /**
     * Sends a follow-up message or response.
     * @param content - The content of the follow-up message, which can include text, embeds, or components.
     * @returns A promise resolving to a new InteropMessage instance representing the follow-up message.
     */
    followUp(content: MessagePayload): Promise<InteropMessage<Private>>;
}

/**
 * Interface for messages that result from an Interop follow-up.
 */
export interface IInteropMessage<Private extends boolean = boolean> {
    /**
     * Edits the message if it is not private.
     * @param payload - The new content of the message.
     * @returns A promise resolving to an updated InteropMessage.
     */
    readonly edit: Private extends true ? (payload: MessagePayload) => Promise<InteropMessage<false>> : never;

    /**
     * Deletes the message if it is not private.
     * @returns A promise resolving when the deletion is complete.
     */
    readonly delete: Private extends true ? () => Promise<void> : never;
}

/**
 * A class providing a unified interface for handling Discord CommandInteractions and Messages.
 * Allows actions like sending follow-ups and deleting responses, abstracting the differences
 * between interaction-based and message-based commands.
 * @template T - Indicates whether the interaction is private.
 */
export default class Interop<T extends boolean = boolean> implements IInterop {
    private readonly replyFunction: (content: MessagePayload) => Promise<Message>;

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
    public constructor(public readonly base: CommandInteraction | Message, public readonly isPrivate: T) {
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
    }

    /**
     * Sends a follow-up message or response.   
     * @param content - The content of the follow-up message, which can include text, embeds, or components.
     * @returns A promise resolving to a new Interop instance representing the follow-up message.
     */
    async followUp(content: MessagePayload): Promise<InteropMessage<T>> {
        return new InteropMessage(await this.replyFunction(content), this.isPrivate);
    }

    /**
     * Type guard for checking if a given base object is a CommandInteraction.
     * @param base - The object to check.
     * @returns True if the base is a CommandInteraction, false otherwise.
     */
    public static isCommandInteraction(base: any): base is CommandInteraction {
        return base instanceof CommandInteraction;
    }

    /**
     * Type guard for checking if a given base object is a Message.
     * @param base - The object to check.
     * @returns True if the base is a Message, false otherwise.
     */
    public static isMessage(base: any): base is Message {
        return base instanceof Message;
    }
}

/**
 * Class representing a message sent as a follow-up in an Interop instance.
 * Provides methods for editing and deleting the message when applicable.
 */
export class InteropMessage<T extends boolean = boolean> extends Interop<T> implements IInteropMessage {
    private readonly editFunction: (payload: MessagePayload) => Promise<Message<boolean>>;
    private readonly deleterFunction: () => Promise<void>;

    /**
     * Initializes an InteropMessage instance.
     * @param base - The base Message instance.
     * @param isPrivate - Indicates whether the message is private.
     */
    public constructor(public readonly base: Message, public readonly isPrivate: T) {
        super(base, isPrivate);

        this.deleterFunction = () => base.delete()
            .then(() => Promise.resolve())
            .catch(err => Promise.reject(new Error(`Failed to delete message: ${err.message}`)));

        this.editFunction = (payload: MessagePayload) => base.edit(payload)
            .then(e => Promise.resolve(e))
            .catch(err => Promise.reject(new Error(`Failed to delete message: ${err.message}`)));
    }

    /**
     * Edits the message content if it is not private.
     * @param payload - The new content of the message.
     * @returns A promise resolving to the updated InteropMessage.
     * @throws {Error} If edit is called on a private message.
     */
    public async edit(payload: MessagePayload) {
        if (this.isPrivate) {
            throw new Error("Edit is not available for private messages.");
        }

        return new InteropMessage<false>(await this.editFunction(payload), this.isPrivate);
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
}

