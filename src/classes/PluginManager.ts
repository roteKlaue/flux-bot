import { promises as fs } from "node:fs";
import { Plugin } from "../types/FluxPlugin";
import FluxClient from "./Client";
import { join } from "node:path";
import { PromiseUtil } from "sussy-util";

export default class PluginManager {
    constructor(private readonly client: FluxClient) { }

    /**
     * Dynamically loads plugins into the client.
     * Plugins can either be provided as an array of plugin objects or as a folder path containing plugin files.
     * Valid plugins are initialized and registered with the client.
     * @param plugins - Either an array of plugin objects or a string path to the plugin folder.
     */
    async loadPlugins(plugins: string | Plugin[]) {
        if (Array.isArray(plugins)) {
            for (const plugin of plugins) {
                await this.loadPlugin(plugin);
            }
            return;
        }

        const files = await PromiseUtil.filter(await fs.readdir(plugins), async file => {
            const filePath = join(plugins, file);
            return (await fs.lstat(filePath)).isFile() && file.endsWith(".js");
        });

        for (const file of files) {
            const modulePath = join(plugins, file);
            try {
                const importedModule = await import(modulePath);

                const plugin: Plugin = importedModule.default || importedModule;
                await this.loadPlugin(plugin);
            } catch (error) {
                this.client.logger?.error(`Failed to load plugin: ${file}. Check plugin structure and export.`, { error });
                this.client.emit("pluginLoadError", { error, file });
            }
        }
    }

    /**
     * Loads and initializes a single plugin instance.
     * Registers the plugin's commands and middleware with the client.
     * Logs errors if the plugin fails validation or initialization.
     * @param plugin - The plugin instance to load.
     */
    async loadPlugin(plugin: Plugin) {
        if (!this.isValidPlugin(plugin)) {
            this.client.logger?.warn(`Invalid plugin structure for: ${JSON.stringify(plugin)}`);
            return;
        }

        try {
            await plugin.init(this.client);
            this.client.plugins.set(plugin.name, plugin);
            this.client.logger?.info(`Loaded plugin: ${plugin.name} (v${plugin.version})`);

            if (plugin.commands && plugin.commands.length > 0) {
                this.client.loadCommands(plugin.commands);
                this.client.logger?.info(`Loaded ${plugin.commands.length} command(s) from plugin: ${plugin.name}`);
            }

            if (plugin.preExecutionMiddleware) {
                plugin.preExecutionMiddleware.forEach(mw => this.client.registerPreExecutionMiddleware(mw));
                this.client.logger?.info(`Registered ${plugin.preExecutionMiddleware.length} pre-execution middleware from plugin: ${plugin.name}`);
            }

            if (plugin.postExecutionMiddleware) {
                plugin.postExecutionMiddleware.forEach(mw => this.client.registerPostExecutionMiddleware(mw));
                this.client.logger?.info(`Registered ${plugin.postExecutionMiddleware.length} post-execution middleware from plugin: ${plugin.name}`);
            }
        } catch (error) {
            this.client.logger?.error(`Failed to initialize plugin: ${plugin.name}`, { error });
            this.client.emit("pluginInitError", { plugin, error });
        }
    }

    /**
     * Unloads all plugins currently registered with the client.
     * Ensures that each plugin's `destroy` method is called if available.
     * Clears the plugin collection on the client.
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
     * Validates that an object adheres to the `Plugin` interface.
     * A valid plugin must have a `name`, `version`, and an `init` function.
     * @param plugin - The object to validate.
     * @returns True if the object matches the `Plugin` interface, false otherwise.
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
