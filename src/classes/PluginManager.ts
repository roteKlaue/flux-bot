import { readdirSync, lstatSync } from "node:fs";
import { Plugin } from "../types/FluxPlugin";
import FluxClient from "./Client";
import { join } from "node:path";

export default class PluginManager {
    constructor(private client: FluxClient) { }

    /**
     * Loads all plugins from the plugin folder.
     * Dynamically imports and initializes plugins.
     */
    async loadPlugins(plugins: string | Plugin[]) {
        if (Array.isArray(plugins)) {
            for (const plugin of plugins) {
                await this.loadPlugin(plugin);
            }
            return;
        }

        const files = readdirSync(plugins).filter(file => {
            const filePath = join(plugins, file);
            return lstatSync(filePath).isFile() && file.endsWith(".js");
        });

        for (const file of files) {
            const modulePath = join(plugins, file);
            try {
                const importedModule = await import(modulePath);

                const plugin: Plugin = importedModule.default || importedModule;
                this.loadPlugin(plugin);
            } catch (error) {
                this.client.logger?.error(`Failed to load plugin: ${file}`, { error });
            }
        }
    }

    async loadPlugin(plugin: Plugin) {
        if (!this.isValidPlugin(plugin)) {
            this.client.logger?.warn(`Invalid plugin structure for: ${JSON.stringify(plugin)}`);
            return;
        }

        try {
            await plugin.init(this.client);
            this.client.plugins.set(plugin.name, plugin);
            this.client.logger?.info(`Loaded plugin: ${plugin.name} (v${plugin.version})`);
        } catch (error) {
            this.client.logger?.error(`Failed to initialize plugin: ${plugin.name}`, { error });
        }
    }

    /**
     * Unloads all loaded plugins.
     * Ensures that each plugin's `destroy` method is called if available.
     */
    async unloadPlugins() {
        for (const plugin of this.client.plugins.values()) {
            try {
                await plugin.destroy?.();
                this.client.logger?.info(`Unloaded plugin: ${plugin.name}`);
            } catch (error) {
                this.client.logger?.error(`Failed to destroy plugin: ${plugin.name}`, { error });
            }
        }

        this.client.plugins.clear();
    }

    /**
     * Checks if an object matches the Plugin interface.
     * @param plugin - The object to validate.
     * @returns True if the object is a valid plugin, false otherwise.
     */
    public isValidPlugin(plugin: any): plugin is Plugin {
        return (
            plugin &&
            typeof plugin.name === "string" &&
            typeof plugin.version === "string" &&
            typeof plugin.init === "function"
        );
    }
}
