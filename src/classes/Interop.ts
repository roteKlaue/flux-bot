import { Channel, CommandInteraction, EmbedBuilder, Message, User, APIActionRowComponent, APIMessageActionRowComponent, Guild, GuildMember } from "discord.js";
import EventEmitter from "node:events";

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

export default class Interop<T extends boolean = boolean> extends EventEmitter implements IInterop {
    private readonly replyFunction: (content: MessagePayload) => Promise<Message>;
    private readonly deleterFunction: () => Promise<void>;

    public readonly member: GuildMember | undefined;
    public readonly channel: Channel | null;
    public readonly guild: Guild | null;
    public readonly createdAt: Date;
    public readonly user: User;

    /**
     * Initializes an Interop instance.
     * @param base - The base CommandInteraction or Message.
     * @param isPrivate - Whether this is a private interaction.
     */
    public constructor(private readonly base: CommandInteraction | Message<boolean>, private readonly isPrivate: T) {
        super();

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
     */
    public delete(): Promise<void> {
        if (this.isPrivate) {
            throw new Error("Delete is not available for private messages.");
        }
        return this.deleterFunction();
    }

    /**
     * Sends a follow-up message or response.
     * @param content - The content of the follow-up message.
     * @returns A new Interop instance representing the follow-up.
     */
    async followUp(content: MessagePayload): Promise<Interop<T>> {
        return new Interop(await this.replyFunction(content), this.isPrivate);
    }

    /**
     * Type guard for CommandInteraction.
     * @param base - The base object to check.
     * @returns True if base is a CommandInteraction, false otherwise.
     */
    private static isCommandInteraction(base: any): base is CommandInteraction {
        return base instanceof CommandInteraction;
    }

    /**
     * Type guard for Message.
     * @param base - The base object to check.
     * @returns True if base is a Message, false otherwise.
     */
    private static isMessage(base: any): base is Message {
        return base instanceof Message;
    }
}
