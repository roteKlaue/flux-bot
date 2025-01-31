import { APIActionRowComponent, APIMessageActionRowComponent, EmbedBuilder } from "discord.js";

/**
 * Defines the structure for message payloads that can be sent in interactions.
 */
export type MessagePayload = string | {
    content?: string;
    embeds?: EmbedBuilder[];
    components?: APIActionRowComponent<APIMessageActionRowComponent>[];
};