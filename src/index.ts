import { IoTMCP } from "./iot-server";

// Export the IoTMCP class for Durable Objects
export { IoTMCP };

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Direct SSE endpoint without OAuth
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return IoTMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		// Optional HTTP endpoint
		if (url.pathname === "/mcp") {
			return IoTMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Simple homepage
		if (url.pathname === "/") {
			return new Response(`
				<h1>Acceleronix IoT MCP Server</h1>
				<p>MCP SSE Endpoint: /sse</p>
				<p>MCP HTTP Endpoint: /mcp</p>
				<p>Status: Ready (No OAuth required)</p>
			`, { 
				headers: { "content-type": "text/html" } 
			});
		}

		return new Response("Not found", { status: 404 });
	},
};
