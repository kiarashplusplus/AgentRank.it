/**
 * AgentRank.it MCP Server
 *
 * Model Context Protocol server for IDE integration.
 * Allows developers to audit sites directly from Cursor or Claude Desktop.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleMCPRequest, type MCPRequest } from './handlers.js';

/**
 * Default MCP server port
 */
const DEFAULT_PORT = 3000;

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
    port?: number;
    host?: string;
}

/**
 * Start the MCP server
 */
export async function startMCPServer(config: MCPServerConfig = {}): Promise<void> {
    const port = config.port ?? DEFAULT_PORT;
    const host = config.host ?? 'localhost';

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        // CORS headers for local development
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Health check
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }));
            return;
        }

        // MCP endpoint
        if (req.url === '/mcp' && req.method === 'POST') {
            let body = '';

            req.on('data', (chunk: Buffer) => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const request = JSON.parse(body) as MCPRequest;
                    const response = await handleMCPRequest(request);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(response));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            status: 'error',
                            error: {
                                code: 'INVALID_REQUEST',
                                message: error instanceof Error ? error.message : 'Invalid request',
                            },
                        })
                    );
                }
            });
            return;
        }

        // 404 for all other routes
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    return new Promise((resolve) => {
        server.listen(port, host, () => {
            console.log(`🚀 AgentRank.it MCP Server running at http://${host}:${port}`);
            console.log(`   Health: http://${host}:${port}/health`);
            console.log(`   MCP:    POST http://${host}:${port}/mcp`);
            resolve();
        });
    });
}

/**
 * Export for programmatic use
 */
export { handleMCPRequest } from './handlers.js';
