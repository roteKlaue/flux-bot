import { AnySelectMenuInteraction, ButtonInteraction, CommandInteraction, Interaction, Message } from "discord.js";
import FluxClient from "../classes/Client";
import Interop from "../classes/Interop";
import Command from "../classes/Command";
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
    onCommandCall?: (interop: Interop) => PromiseOr<void>;
    provideCommandArguments?: (interop: Interop, command: Command<any>) => PromiseOr<Record<string, any>>;
}
