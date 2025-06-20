import app from "./app";
import { IoTMCP } from "./iot-server";
import OAuthProvider from "@cloudflare/workers-oauth-provider";

// Export the IoTMCP class for Durable Objects
export { IoTMCP };

// Export the OAuth handler as the default
export default new OAuthProvider({
	apiRoute: "/sse",
	// TODO: fix these types
	// @ts-expect-error
	apiHandler: IoTMCP.mount("/sse"),
	// @ts-expect-error
	defaultHandler: app,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
});
