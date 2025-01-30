import { Plugin } from "../types/FluxPlugin";
import { PromiseUtil } from "sussy-util";
import { promises as fs } from "node:fs";
import { satisfies } from "semver";
import FluxClient from "./Client";
import { join } from "node:path";

export default class PluginManager {
    private loadedPlugins: Map<string, string> = new Map();

    constructor(private readonly client: FluxClient) { }

    /**
     * Dynamically loads plugins into the client.
     * Plugins can either be provided as an array of plugin objects or as a folder path containing plugin files.
     * Valid plugins are initialized and registered with the client.
     * @param plugins - Either an array of plugin objects or a string path to the plugin folder.
     */
    async loadPlugins(plugins: string | Plugin[]) {
        if (Array.isArray(plugins)) {
            await this.resolveDependenciesAndLoad(plugins);
            return;
        }

        const files = await PromiseUtil.filter(await fs.readdir(plugins), async file => {
            const filePath = join(plugins, file);
            return (await fs.lstat(filePath)).isFile() && file.endsWith(".js");
        });

        const loadedPlugins: Plugin[] = [];
        for (const file of files) {
            const modulePath = join(plugins, file);
            try {
                const importedModule = await import(modulePath);
                const plugin: Plugin = importedModule.default || importedModule;
                loadedPlugins.push(plugin);
            } catch (error) {
                this.client.logger?.error(`Failed to load plugin: ${file}. Check plugin structure and export.`, { error });
                this.client.emit("pluginLoadError", { error, file });
            }
        }

        await this.resolveDependenciesAndLoad(loadedPlugins);
    }

    /**
     * Resolves dependencies and loads plugins in the correct order.
     * @param plugins - Array of plugin objects.
     */
    private async resolveDependenciesAndLoad(plugins: Plugin[]) {
        const dependencyGraph = new Map<string, string[]>();

        for (const plugin of plugins) {
            dependencyGraph.set(plugin.name, (plugin.dependencies || []).map(d => d.name));
        }

        let sortedPlugins: string[] = [];
        try {
            sortedPlugins = this.topologicalSort(dependencyGraph);
        } catch (e) {
            this.client.emit("pluginInitError", { error: e });
            return;
        }

        const validPlugins: Plugin[] = plugins.filter(plugin => {
            if (!plugin.dependencies) return true;

            const missingDeps = plugin.dependencies.filter(dep => {
                const loadedVersion = this.loadedPlugins.get(dep.name);
                return !loadedVersion || !satisfies(loadedVersion, dep.version);
            });

            if (missingDeps.length > 0) {
                this.client.logger?.error(`Plugin "${plugin.name}" cannot be loaded due to missing or incompatible dependencies: ${missingDeps.map(d => `"${d.name}"`).join(", ")}`);
                this.client.emit("pluginInitError", {
                    error: new Error(`Missing or incompatible dependencies for "${plugin.name}"`),
                    plugin,
                    dependencies: missingDeps
                });
                return false;
            }

            return true;
        });

        for (const pluginName of sortedPlugins) {
            const plugin = validPlugins.find(p => p.name === pluginName);
            if (!plugin) continue;
            await this.loadPlugin(plugin);
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

            this.loadedPlugins.set(plugin.name, plugin.version);
        } catch (error) {
            this.client.logger?.error(`Failed to initialize plugin: ${plugin.name}`, { error });
            this.client.emit("pluginInitError", { plugin, error });
        }
    }

    /**
     * Performs topological sorting to determine the correct load order for plugins.
     * Detects circular dependencies and prevents infinite loops.
     * @param graph - A map representing plugin dependencies.
     * @returns An ordered list of plugin names.
     * @throws Error if a circular dependency is detected.
     */
    private topologicalSort(graph: Map<string, string[]>): string[] {
        const sorted: string[] = [];
        const visited = new Set<string>();
        const stack = new Set<string>();

        const visit = (plugin: string) => {
            if (stack.has(plugin)) {
                throw new Error(`Circular dependency detected: ${[...stack, plugin].join(" → ")}`);
            }
            if (!visited.has(plugin)) {
                stack.add(plugin);
                for (const dep of graph.get(plugin) || []) {
                    visit(dep);
                }
                stack.delete(plugin);
                visited.add(plugin);
                sorted.push(plugin);
            }
        };

        for (const plugin of graph.keys()) {
            visit(plugin);
        }

        return sorted;
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
