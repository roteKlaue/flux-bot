import { AnySelectMenuInteraction, ButtonInteraction, CommandInteraction, Interaction, Message } from "discord.js";
import FluxClient from "../classes/Client";
import { PromiseOr } from "sussy-util";

export interface Plugin {
    name: string;
    version: string;
    init: (client: FluxClient) => PromiseOr<void>;
    destroy?: () => PromiseOr<void>;
    onMessage?: (message: Message) => PromiseOr<void>;
    onInteraction?: (interaction: Interaction) => PromiseOr<void>;
    onCommandInteraction?: (interaction: CommandInteraction) => PromiseOr<void>;
    onMenuInteraction?: (interaction: AnySelectMenuInteraction) => PromiseOr<void>;
    onButtonInteraction?: (interaction: ButtonInteraction) => PromiseOr<void>;
}
