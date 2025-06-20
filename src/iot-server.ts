// IoT MCP Server implementation for Cloudflare Workers
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  IoTEnvironment,
  listProducts,
  getProductTslJson,
  getProductThingModel,
  listDevices,
  getDeviceDetail,
  powerSwitch,
  queryDeviceLocation,
  queryDeviceResources,
  formatTimestampWithTimezone,
  formatAccessType,
  formatNetworkWay,
  formatDataFmt,
  formatAuthMode,
  getAccessToken
} from "./iot-utils";

export class IoTMCP extends McpAgent {
  server = new McpServer({
    name: "IoT MCP Server",
    version: "1.0.0",
  });

  async init() {
    // Get environment variables from the Durable Object's env
    const env = this.env as unknown as IoTEnvironment;
    
    // Validate that environment variables are available
    if (!env.BASE_URL || !env.ACCESS_KEY || !env.ACCESS_SECRET) {
      console.error('Missing required environment variables:', {
        BASE_URL: !!env.BASE_URL,
        ACCESS_KEY: !!env.ACCESS_KEY,
        ACCESS_SECRET: !!env.ACCESS_SECRET
      });
      throw new Error('Missing required IoT API environment variables');
    }

    // List products tool
    this.server.tool(
      "list_products",
      {
        page_size: z.number().optional().default(100).describe("Number of products per page (default: 100)")
      },
      async ({ page_size }) => {
        try {
          const products = await listProducts(env, page_size);
          
          if (!products || products.length === 0) {
            return {
              content: [{ type: "text", text: "No products found in your account." }]
            };
          }

          const productList = [`Product list (total: ${products.length} products):`, "=" .repeat(60)];
          
          products.forEach((product, i) => {
            const createTime = formatTimestampWithTimezone(product.createTime);
            const updateTime = formatTimestampWithTimezone(product.updateTime);
            
            const productInfo = `
${i + 1}. ${product.productName || 'Unknown'}
   Product Key: ${product.productKey || 'N/A'}
   Access Type: ${formatAccessType(product.accessType)} (${product.accessType})
   Network Way: ${formatNetworkWay(product.netWay)} (${product.netWay})
   Data Format: ${formatDataFmt(product.dataFmt)} (${product.dataFmt})
   Connect Platform: ${product.connectPlatform || 'N/A'}
   Created Time: ${createTime}
   Updated Time: ${updateTime}`;
            
            productList.push(productInfo);
          });

          return {
            content: [{ type: "text", text: productList.join("\n") }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // List products detailed tool
    this.server.tool(
      "list_products_detailed",
      {
        page_size: z.number().optional().default(100).describe("Number of products per page (default: 100)")
      },
      async ({ page_size }) => {
        try {
          const products = await listProducts(env, page_size);
          
          if (!products || products.length === 0) {
            return {
              content: [{ type: "text", text: "No products found in your account." }]
            };
          }

          const productList = [`Detailed Product List (total: ${products.length} products):`, "=" .repeat(80)];
          
          products.forEach((product, i) => {
            const createTime = formatTimestampWithTimezone(product.createTime);
            const updateTime = formatTimestampWithTimezone(product.updateTime);
            
            const productInfo = `
${i + 1}. ${product.productName || 'Unknown'}
   Product Key: ${product.productKey || 'N/A'}
   Access Type: ${formatAccessType(product.accessType)} (${product.accessType})
   Network Way: ${formatNetworkWay(product.netWay)} (${product.netWay})
   Data Format: ${formatDataFmt(product.dataFmt)} (${product.dataFmt})
   Connect Platform: ${product.connectPlatform || 'N/A'}
   Created Time: ${createTime}
   Updated Time: ${updateTime}
   Raw Data: ${JSON.stringify(product)}`;
            
            productList.push(productInfo);
          });

          return {
            content: [{ type: "text", text: productList.join("\n") }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Get product definition tool
    this.server.tool(
      "get_product_definition",
      {
        product_key: z.string().describe("Product key to get TSL definition for")
      },
      async ({ product_key }) => {
        try {
          const tslJson = await getProductTslJson(env, product_key);
          return {
            content: [{ type: "text", text: JSON.stringify(tslJson, null, 2) }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Get product thing model tool
    this.server.tool(
      "get_product_thing_model",
      {
        product_id: z.number().optional().describe("Product ID (takes precedence over product_key)"),
        product_key: z.string().optional().describe("Product Key"),
        language: z.string().optional().default('CN').describe("Language setting CN/EN (default: CN)")
      },
      async ({ product_id, product_key, language }) => {
        try {
          const thingModel = await getProductThingModel(env, product_id, product_key, language);
          return {
            content: [{ type: "text", text: JSON.stringify(thingModel, null, 2) }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // List devices tool
    this.server.tool(
      "list_devices",
      {
        product_key: z.string().describe("Product key to list devices for")
      },
      async ({ product_key }) => {
        try {
          const devices = await listDevices(env, product_key);
          return {
            content: [{ type: "text", text: JSON.stringify(devices, null, 2) }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // List devices formatted tool
    this.server.tool(
      "list_devices_formatted",
      {
        product_key: z.string().describe("Product key to list devices for")
      },
      async ({ product_key }) => {
        try {
          const devices = await listDevices(env, product_key);
          
          if (!devices || devices.length === 0) {
            return {
              content: [{ type: "text", text: `No devices found for product key: ${product_key}` }]
            };
          }

          const deviceList = [`Device list for product ${product_key} (total: ${devices.length} devices):`, "=" .repeat(60)];
          
          devices.forEach((device, i) => {
            const deviceInfo = `
${i + 1}. ${device.deviceName || 'Unknown'}
   Device Key: ${device.deviceKey || 'N/A'}
   Product Key: ${device.productKey || 'N/A'}
   Serial Number: ${device.sn || 'N/A'}
   Status: ${device.deviceStatus === 1 ? 'Online' : 'Offline'} (${device.deviceStatus})
   Activated: ${device.isActived === 1 ? '✓' : '✗'} (${device.isActived})
   Virtual Device: ${device.isVirtual === 1 ? 'Yes' : 'No'} (${device.isVirtual})
   Verification Status: ${device.isVerified === 1 ? 'Verified' : 'Not Verified'} (${device.isVerified})
   Auth Mode: ${formatAuthMode(device.authMode)} (${device.authMode})
   Data Format: ${formatDataFmt(device.dataFmt)} (${device.dataFmt})
   Created Time: ${formatTimestampWithTimezone(device.createTime)}
   Activated Time: ${formatTimestampWithTimezone(device.activedTime)}
   Last Update: ${formatTimestampWithTimezone(device.updateTime)}`;
            
            deviceList.push(deviceInfo);
          });

          return {
            content: [{ type: "text", text: deviceList.join("\n") }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Get device details tool
    this.server.tool(
      "get_device_details",
      {
        product_key: z.string().describe("Product key"),
        device_key: z.string().describe("Device key")
      },
      async ({ product_key, device_key }) => {
        try {
          const deviceDetail = await getDeviceDetail(env, product_key, device_key);
          const deviceResources = await queryDeviceResources(env, product_key, device_key).catch(() => ({}));

          let deviceInfo = `
Device Detailed Information (Enhanced Detail API):
==========================================
Basic Information:
Device Name: ${deviceDetail.deviceName || 'N/A'}
Device Key: ${deviceDetail.deviceKey || 'N/A'}
Serial Number: ${deviceDetail.sn || 'N/A'}
Product Key: ${deviceDetail.productKey || 'N/A'}

Status Information:
Device Status: ${deviceDetail.deviceStatus || 'N/A'} (${deviceDetail.deviceStatus === 1 ? '🟢 Online' : '🔴 Offline'})
Activation Status: ${deviceDetail.isActived === 1 ? 'Activated' : 'Not Activated'}
Verification Status: ${deviceDetail.isVerified === 1 ? 'Verified' : 'Not Verified'}
Virtual Device: ${deviceDetail.isVirtual === 1 ? 'Yes' : 'No'}

Time Information (UTC and UTC+8 timezone):
Created Time: ${deviceDetail.formattedCreateTime || 'N/A'}
Activated Time: ${deviceDetail.formattedActivedTime || 'N/A'}
First Connection: ${deviceDetail.formattedFirstConnTime || 'N/A'}
Last Connection: ${deviceDetail.formattedLastConnTime || 'N/A'}
Last Offline: ${deviceDetail.formattedLastOfflineTime || 'N/A'}
Data Update: ${deviceDetail.formattedUpdateTime || 'N/A'}

Technical Parameters:
Data Format: ${deviceDetail.dataFmt || 'N/A'} (${deviceDetail.dataFmt === 3 ? 'Thing Model' : 'Transparent Transmission'})
Auth Mode: ${deviceDetail.authMode || 'N/A'} (${formatAuthMode(deviceDetail.authMode)})`;

          if (deviceResources && Object.keys(deviceResources).length > 0) {
            deviceInfo += `

Resource Information:
ICCID: ${deviceResources.iccId || 'N/A'}
Phone Number: ${deviceResources.phoneNum || 'N/A'}
SIM Number: ${deviceResources.simNum || 'N/A'}
Battery Level: ${deviceResources.battery || 'N/A'}
Signal Strength: ${deviceResources.signalStrength || 'N/A'}
Firmware Version: ${deviceResources.version || 'N/A'}
Voltage: ${deviceResources.voltage || 'N/A'}`;
          } else {
            deviceInfo += `

Resource Information:
Unable to retrieve device resource information.`;
          }

          return {
            content: [{ type: "text", text: deviceInfo }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Get device TSL properties tool
    this.server.tool(
      "get_device_tsl_properties",
      {
        product_key: z.string().describe("Product key"),
        device_key: z.string().describe("Device key")
      },
      async ({ product_key, device_key }) => {
        try {
          const tslDefinition = await getProductTslJson(env, product_key);
          
          let info = `
Device TSL Property Data Query:
========================
Device Key: ${device_key}
Product Key: ${product_key}

TSL Definition Summary:`;

          if (tslDefinition && tslDefinition.properties) {
            const properties = tslDefinition.properties;
            info += `
Supported Properties Count: ${properties.length}
Property List:`;
            properties.forEach((prop: any) => {
              const unit = prop.specs?.unit || '';
              info += `
  - ${prop.name || 'N/A'} (${prop.code || 'N/A'}) [${unit}]`;
            });
          } else {
            info += `
Unable to get TSL definition`;
          }

          info += `

Notes:
- TSL definition shows all properties supported by the device
- For real-time data, use get_device_details or query specific endpoints
- If no real-time data, device may be offline or API endpoint mismatch`;

          return {
            content: [{ type: "text", text: info }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Get device latest online time tool
    this.server.tool(
      "get_device_latest_online_time",
      {
        product_key: z.string().describe("Product key"),
        device_key: z.string().describe("Device key")
      },
      async ({ product_key, device_key }) => {
        try {
          const deviceDetail = await getDeviceDetail(env, product_key, device_key);
          const locationData = await queryDeviceLocation(env, product_key, device_key).catch(() => ({}));

          const times: Array<{ time: number, source: string }> = [];
          
          if (deviceDetail.updateTime) {
            times.push({ time: deviceDetail.updateTime, source: 'device_update' });
          }
          if (deviceDetail.lastConnTime) {
            times.push({ time: deviceDetail.lastConnTime, source: 'last_connection' });
          }
          if (locationData.locateTime) {
            times.push({ time: locationData.locateTime, source: 'location' });
          }

          let latestTime = 0;
          let source = 'unknown';
          
          if (times.length > 0) {
            const latest = times.reduce((prev, current) => (prev.time > current.time) ? prev : current);
            latestTime = latest.time;
            source = latest.source;
          }

          const info = `
Device Latest Online Time Analysis (Enhanced):
==================================
Device Key: ${device_key}

Data Source Comparison:
- Device Update Time: ${deviceDetail.updateTime ? formatTimestampWithTimezone(deviceDetail.updateTime) : 'N/A'}
- Last Connection Time: ${deviceDetail.lastConnTime ? formatTimestampWithTimezone(deviceDetail.lastConnTime) : 'N/A'}
- Location Service Time: ${locationData.locateTime ? formatTimestampWithTimezone(locationData.locateTime) : 'N/A'}

Final Result:
- Latest Online Time: ${latestTime ? formatTimestampWithTimezone(latestTime) : 'N/A'}
- Data Source: ${source}
- Raw Timestamp: ${latestTime}

Data Source Description:
- device_update: From device overview API updateTime
- last_connection: From device detail API lastConnTime (more accurate)
- location: From location service API locateTime
- System automatically selects the latest time as final result`;

          return {
            content: [{ type: "text", text: info }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Power switch tool
    this.server.tool(
      "power_switch",
      {
        product_key: z.string().describe("Product key identifying the product"),
        device_key: z.string().describe("Device key identifying the specific device"),
        on_off: z.string().describe('"on" to turn on, "off" to turn off')
      },
      async ({ product_key, device_key, on_off }) => {
        try {
          const result = await powerSwitch(env, product_key, device_key, on_off);
          return {
            content: [{ type: "text", text: result }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Query device location tool
    this.server.tool(
      "query_device_location",
      {
        product_key: z.string().optional().describe("Product key (required if device_id is not provided)"),
        device_key: z.string().optional().describe("Device key (required if device_id is not provided)"),
        device_id: z.number().optional().describe("Device ID (takes precedence over product_key/device_key)"),
        language: z.string().optional().default('CN').describe("Language setting CN/EN (default: CN)")
      },
      async ({ product_key, device_key, device_id, language }) => {
        try {
          const locationData = await queryDeviceLocation(env, product_key, device_key, device_id, language);
          
          const formattedInfo = [
            `Device Key: ${locationData.deviceKey || 'N/A'}`,
            `Product Key: ${locationData.productKey || 'N/A'}`,
            `Location Time: ${locationData.formattedLocateTime || 'N/A'}`,
            `Location Status: ${locationData.locateStatus || 'N/A'}`
          ];

          if (locationData.wgsLat && locationData.wgsLng) {
            formattedInfo.push(`WGS84 Coordinates: ${locationData.wgsLat}, ${locationData.wgsLng}`);
          }
          if (locationData.gcjLat && locationData.gcjLng) {
            formattedInfo.push(`GCJ02 Coordinates: ${locationData.gcjLat}, ${locationData.gcjLng}`);
          }
          if (locationData.accuracy) {
            formattedInfo.push(`Accuracy: ${locationData.accuracy}`);
          }

          return {
            content: [{ type: "text", text: formattedInfo.join('\n') }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Get device location raw tool
    this.server.tool(
      "get_device_location_raw",
      {
        product_key: z.string().optional().describe("Product key (required if device_id is not provided)"),
        device_key: z.string().optional().describe("Device key (required if device_id is not provided)"),
        device_id: z.number().optional().describe("Device ID (takes precedence over product_key/device_key)"),
        language: z.string().optional().default('CN').describe("Language setting CN/EN (default: CN)")
      },
      async ({ product_key, device_key, device_id, language }) => {
        try {
          const locationData = await queryDeviceLocation(env, product_key, device_key, device_id, language);
          return {
            content: [{ type: "text", text: JSON.stringify(locationData, null, 2) }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Query device resources tool
    this.server.tool(
      "query_device_resources",
      {
        product_key: z.string().describe("Product key"),
        device_key: z.string().describe("Device key"),
        language: z.string().optional().default('CN').describe("Language setting CN/EN (default: CN)")
      },
      async ({ product_key, device_key, language }) => {
        try {
          const resources = await queryDeviceResources(env, product_key, device_key, language);
          
          if (!resources || Object.keys(resources).length === 0) {
            return {
              content: [{ type: "text", text: "No device resources found or an error occurred." }]
            };
          }

          const formattedOutput = [
            "Device Resource Information:",
            "=" .repeat(20)
          ];
          
          Object.entries(resources).forEach(([key, value]) => {
            formattedOutput.push(`${key}: ${value}`);
          });

          return {
            content: [{ type: "text", text: formattedOutput.join('\n') }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Health check tool
    this.server.tool(
      "health_check",
      {},
      async () => {
        try {
          // Debug environment variables
          const envDebug = {
            BASE_URL: env.BASE_URL ? `${env.BASE_URL.substring(0, 20)}...` : 'MISSING',
            ACCESS_KEY: env.ACCESS_KEY ? `${env.ACCESS_KEY.substring(0, 8)}...` : 'MISSING',
            ACCESS_SECRET: env.ACCESS_SECRET ? '***PRESENT***' : 'MISSING'
          };
          
          console.log('Health check - Environment variables:', envDebug);
          
          if (!env.BASE_URL || !env.ACCESS_KEY || !env.ACCESS_SECRET) {
            return {
              content: [{ 
                type: "text", 
                text: `IoT MCP Server configuration error. Environment variables status: ${JSON.stringify(envDebug)}` 
              }]
            };
          }
          
          const token = await getAccessToken(env);
          if (token) {
            return {
              content: [{ 
                type: "text", 
                text: `IoT MCP Server is healthy and ready to serve requests. Connected to: ${env.BASE_URL}` 
              }]
            };
          } else {
            return {
              content: [{ type: "text", text: "IoT MCP Server has authentication issues" }]
            };
          }
        } catch (error) {
          const envStatus = {
            BASE_URL: !!env?.BASE_URL,
            ACCESS_KEY: !!env?.ACCESS_KEY,
            ACCESS_SECRET: !!env?.ACCESS_SECRET
          };
          return {
            content: [{ 
              type: "text", 
              text: `IoT MCP Server health check failed: ${error instanceof Error ? error.message : String(error)}. Env status: ${JSON.stringify(envStatus)}` 
            }]
          };
        }
      }
    );
  }
}