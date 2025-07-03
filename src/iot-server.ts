// IoT MCP Server implementation for Cloudflare Workers
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  IoTEnvironment,
  listProducts,
  listProductsPaginated,
  listDevicesPaginated,
  getProductTslJson,
  getProductThingModel,
  listDevices,
  getDeviceDetail,
  powerSwitch,
  queryDeviceLocation,
  queryDeviceResources,
  readDeviceData,
  queryDeviceDataHistory,
  queryDeviceEventHistory,
  formatTimestampWithTimezone,
  formatAccessType,
  formatNetworkWay,
  formatDataFmt,
  formatAuthMode,
  getAccessToken,
  PaginatedResponse
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

    // List products tool (DEPRECATED - use list_products_paginated instead to avoid token limits)
    /*
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
    */

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

    // List products paginated tool
    this.server.tool(
      "list_products_paginated",
      {
        cursor: z.string().optional().describe("Pagination cursor for next page (optional)")
      },
      async ({ cursor }) => {
        try {
          const result: PaginatedResponse<any> = await listProductsPaginated(env, cursor, 15);
          
          if (!result.data || result.data.length === 0) {
            return {
              content: [{ type: "text", text: "No products found in your account." }]
            };
          }

          const productList = [`Product list (page results: ${result.data.length} products):`, "=" .repeat(60)];
          
          result.data.forEach((product, i) => {
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

          if (result.nextCursor) {
            productList.push("");
            productList.push(`📄 More products available. Use cursor: ${result.nextCursor}`);
            productList.push("Call this tool again with the cursor parameter to get the next page.");
          } else {
            productList.push("");
            productList.push("✅ End of product list.");
          }

          return {
            content: [{ type: "text", text: productList.join("\n") }],
            ...(result.nextCursor ? { nextCursor: result.nextCursor } : {})
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // List devices paginated tool
    this.server.tool(
      "list_devices_paginated",
      {
        product_key: z.string().describe("Product key to list devices for"),
        cursor: z.string().optional().describe("Pagination cursor for next page (optional)")
      },
      async ({ product_key, cursor }) => {
        try {
          const result: PaginatedResponse<any> = await listDevicesPaginated(env, product_key, cursor, 15);
          
          if (!result.data || result.data.length === 0) {
            return {
              content: [{ type: "text", text: `No devices found for product key: ${product_key}` }]
            };
          }

          const deviceList = [`Device list for product ${product_key} (page results: ${result.data.length} devices):`, "=" .repeat(60)];
          
          result.data.forEach((device, i) => {
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

          if (result.nextCursor) {
            deviceList.push("");
            deviceList.push(`📄 More devices available. Use cursor: ${result.nextCursor}`);
            deviceList.push("Call this tool again with the cursor parameter to get the next page.");
          } else {
            deviceList.push("");
            deviceList.push("✅ End of device list.");
          }

          return {
            content: [{ type: "text", text: deviceList.join("\n") }],
            ...(result.nextCursor ? { nextCursor: result.nextCursor } : {})
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

    // List devices tool (DEPRECATED - use list_devices_paginated instead to avoid token limits)
    /*
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
    */

    // List devices formatted tool (DEPRECATED - use list_devices_paginated instead to avoid token limits)
    /*
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
    */

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

    // Read device shadow data tool
    this.server.tool(
      "read_device_shadow_data",
      {
        product_key: z.string().describe("Product key"),
        device_key: z.string().describe("Device key"),
        properties: z.array(z.string()).describe("Array of property keys to read"),
        cache_time: z.number().optional().default(600).describe("Cache time in seconds (default: 600)"),
        is_cache: z.boolean().optional().default(false).describe("Whether to enable caching (default: false)"),
        is_cover: z.boolean().optional().default(false).describe("Whether to overwrite previously sent data (default: false)"),
        qos: z.number().optional().default(1).describe("QoS level setting (default: 1)"),
        language: z.string().optional().default('CN').describe("Language setting CN/EN (default: CN)")
      },
      async ({ product_key, device_key, properties, cache_time, is_cache, is_cover, qos, language }) => {
        try {
          const result = await readDeviceData(env, product_key, device_key, properties, {
            cacheTime: cache_time,
            isCache: is_cache,
            isCover: is_cover,
            qos,
            language
          });
          
          if (!result || result.length === 0) {
            return {
              content: [{ type: "text", text: "No data returned from device shadow read request." }]
            };
          }

          const formattedOutput = [
            `Device Shadow Data Read Result:`,
            "=" .repeat(40),
            `Product Key: ${product_key}`,
            `Device Key: ${device_key}`,
            `Properties Requested: ${JSON.stringify(properties)}`,
            "",
            "Response Data:"
          ];
          
          result.forEach((item: any, index: number) => {
            formattedOutput.push(`${index + 1}. Device Response:`);
            formattedOutput.push(`   Code: ${item.code}`);
            formattedOutput.push(`   Product Key: ${item.productKey}`);
            formattedOutput.push(`   Device Key: ${item.deviceKey}`);
            formattedOutput.push(`   Ticket: ${item.ticket || 'N/A'}`);
            formattedOutput.push(`   Message: ${item.message || 'N/A'}`);
            formattedOutput.push(`   Raw Data: ${JSON.stringify(item)}`);
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

    // Read device properties tool (simplified version)
    this.server.tool(
      "read_device_properties",
      {
        product_key: z.string().describe("Product key"),
        device_key: z.string().describe("Device key"),
        properties: z.array(z.string()).optional().describe("Array of property keys to read (if not provided, will try to read all available properties)")
      },
      async ({ product_key, device_key, properties }) => {
        try {
          let propertiesToRead = properties;
          
          // If no properties specified, try to get from TSL definition
          if (!propertiesToRead || propertiesToRead.length === 0) {
            try {
              const tslDefinition = await getProductTslJson(env, product_key);
              if (tslDefinition && tslDefinition.properties) {
                propertiesToRead = tslDefinition.properties.map((prop: any) => prop.code || prop.name).filter(Boolean);
              }
            } catch (tslError) {
              console.warn('Failed to get TSL definition, using empty properties array:', tslError);
              propertiesToRead = [];
            }
          }
          
          if (!propertiesToRead || propertiesToRead.length === 0) {
            return {
              content: [{ 
                type: "text", 
                text: "No properties specified and unable to auto-detect from TSL definition. Please specify properties to read." 
              }]
            };
          }
          
          const result = await readDeviceData(env, product_key, device_key, propertiesToRead, {
            isCache: false,
            isCover: false,
            qos: 1
          });
          
          const formattedOutput = [
            `Device Properties Read:`,
            "=" .repeat(30),
            `Device: ${device_key}`,
            `Properties: ${propertiesToRead.join(', ')}`,
            "",
            "Result:",
            JSON.stringify(result, null, 2)
          ];

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

    // Query device data history tool
    this.server.tool(
      "get_device_data_history",
      {
        product_key: z.string().describe("Product key"),
        device_key: z.string().describe("Device key"),
        device_id: z.number().optional().describe("Device ID (optional, takes precedence over productKey/deviceKey)"),
        begin_date_timp: z.number().optional().describe("Start time (timestamp in milliseconds, optional)"),
        end_date_timp: z.number().optional().describe("End time (timestamp in milliseconds, optional)"),
        direction: z.number().optional().describe("Data type: 1 - UP (uplink), 2 - DOWN (downlink) (optional)"),
        language: z.string().optional().default('CN').describe("Language: CN/EN (default: CN)"),
        page_num: z.number().optional().default(1).describe("Page number (default: 1)"),
        page_size: z.number().optional().default(10).describe("Page size (default: 10)"),
        send_status: z.number().optional().describe("Send status: 0 - Not sent; 1 - Sent; -1 - Send failed (optional)")
      },
      async ({ product_key, device_key, device_id, begin_date_timp, end_date_timp, direction, language, page_num, page_size, send_status }) => {
        try {
          const historyData = await queryDeviceDataHistory(env, product_key, device_key, {
            deviceId: device_id,
            beginDateTimp: begin_date_timp,
            endDateTimp: end_date_timp,
            direction,
            language,
            pageNum: page_num,
            pageSize: page_size,
            sendStatus: send_status
          });
          
          if (!historyData || typeof historyData !== 'object') {
            return {
              content: [{ type: "text", text: `Error: Unexpected response format from API: ${String(historyData)}` }]
            };
          }

          const dataEntries = historyData.data || [];
          
          // Handle pagination info - support both direct values and object format
          const currentPageNum = typeof historyData.pageNum === 'object' ? 
            historyData.pageNum?.value || page_num : historyData.pageNum || page_num;
          const itemsPerPage = typeof historyData.pageSize === 'object' ? 
            historyData.pageSize?.value || page_size : historyData.pageSize || page_size;
          const totalPages = typeof historyData.pages === 'object' ? 
            historyData.pages?.value || 'N/A' : historyData.pages || 'N/A';
          const totalItems = typeof historyData.total === 'object' ? 
            historyData.total?.value || 'N/A' : historyData.total || 'N/A';

          const output = [
            `Device Historical Data Records (Device: ${device_key}, Product: ${product_key})`,
            `===================================================================`,
            `Pagination Info: Page ${currentPageNum} / Total ${totalPages} pages (${itemsPerPage} items per page, Total ${totalItems} items)`,
            `-------------------------------------------------------------------`
          ];

          if (!dataEntries || dataEntries.length === 0) {
            output.push("No historical data found for the given criteria.");
            return {
              content: [{ type: "text", text: output.join('\n') }]
            };
          }

          dataEntries.forEach((entry: any, i: number) => {
            const directionStr = entry.direction === 1 ? "Uplink" : 
                                entry.direction === 2 ? "Downlink" : 
                                `Unknown (${entry.direction})`;
            
            const sendStatusStr = entry.sendStatus === 0 ? "Not Sent" : 
                                 entry.sendStatus === 1 ? "Sent" : 
                                 entry.sendStatus === -1 ? "Send Failed" : 
                                 `Unknown (${entry.sendStatus})`;

            // Format timestamps
            const createTime = formatTimestampWithTimezone(entry.createTime);
            const sendTime = formatTimestampWithTimezone(entry.sendTime);
            const updateTime = formatTimestampWithTimezone(entry.updateTime);

            output.push(`\nRecord #${i + 1}:`);
            output.push(`  ID: ${entry.id || 'N/A'}`);
            output.push(`  Direction: ${directionStr}`);
            output.push(`  Message Type: ${entry.msgType || 'N/A'}`);
            output.push(`  Data Type: ${entry.dataType || 'N/A'}`);
            output.push(`  Created Time: ${createTime}`);
            output.push(`  Send Time: ${sendTime}`);
            output.push(`  Update Time: ${updateTime}`);
            output.push(`  Send Status: ${sendStatusStr}`);
            output.push(`  Raw Data (Base64): ${entry.data || 'N/A'}`);
            output.push(`  Thing Model Data (JSON): ${entry.thingModelData || entry.dmData || 'N/A'}`);
            output.push(`  Ticket: ${entry.ticket || 'N/A'}`);
            output.push(`  Source Type: ${entry.sourceType || 'N/A'}`);
            output.push(`  Extended Data: ${JSON.stringify(entry.extData || {})}`);
          });

          return {
            content: [{ type: "text", text: output.join('\n') }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
          };
        }
      }
    );

    // Query device event history tool
    this.server.tool(
      "get_device_event_history",
      {
        product_key: z.string().describe("Product key"),
        device_key: z.string().describe("Device key"),
        device_id: z.number().optional().describe("Device ID (optional, takes precedence over productKey/deviceKey)"),
        begin_date_timp: z.number().optional().describe("Start time (timestamp in milliseconds, optional)"),
        end_date_timp: z.number().optional().describe("End time (timestamp in milliseconds, optional)"),
        event_type: z.string().optional().describe("Event type (Offline:0, Online:1, Reconnect:2, Information:3, Alert:4, Fault:5, Reset:6, optional)"),
        language: z.string().optional().default('CN').describe("Language: CN/EN (default: CN)"),
        page_num: z.number().optional().default(1).describe("Page number (default: 1)"),
        page_size: z.number().optional().default(10).describe("Page size (default: 10)")
      },
      async ({ product_key, device_key, device_id, begin_date_timp, end_date_timp, event_type, language, page_num, page_size }) => {
        try {
          const eventHistoryData = await queryDeviceEventHistory(env, product_key, device_key, {
            deviceId: device_id,
            beginDateTimp: begin_date_timp,
            endDateTimp: end_date_timp,
            eventType: event_type,
            language,
            pageNum: page_num,
            pageSize: page_size
          });
          
          if (!eventHistoryData || typeof eventHistoryData !== 'object') {
            return {
              content: [{ type: "text", text: `Error: Unexpected response format from API: ${String(eventHistoryData)}` }]
            };
          }

          const dataEntries = eventHistoryData.data || [];
          
          // Handle pagination info - support both direct values and object format
          const currentPageNum = typeof eventHistoryData.pageNum === 'object' ? 
            eventHistoryData.pageNum?.value || page_num : eventHistoryData.pageNum || page_num;
          const itemsPerPage = typeof eventHistoryData.pageSize === 'object' ? 
            eventHistoryData.pageSize?.value || page_size : eventHistoryData.pageSize || page_size;
          const totalPages = typeof eventHistoryData.pages === 'object' ? 
            eventHistoryData.pages?.value || 'N/A' : eventHistoryData.pages || 'N/A';
          const totalItems = typeof eventHistoryData.total === 'object' ? 
            eventHistoryData.total?.value || 'N/A' : eventHistoryData.total || 'N/A';

          // Event type mapping
          const eventTypeMap: { [key: string]: string } = {
            "0": "Offline",
            "1": "Online",
            "2": "Reconnect",
            "3": "Information",
            "4": "Alert",
            "5": "Fault",
            "6": "Reset"
          };

          const output = [
            `Device Historical Event Records (Device: ${device_key}, Product: ${product_key})`,
            `===================================================================`,
            `Pagination Info: Page ${currentPageNum} / Total ${totalPages} pages (${itemsPerPage} items per page, Total ${totalItems} items)`,
            `-------------------------------------------------------------------`
          ];

          if (!dataEntries || dataEntries.length === 0) {
            output.push("No historical event data found for the given criteria.");
            return {
              content: [{ type: "text", text: output.join('\n') }]
            };
          }

          dataEntries.forEach((entry: any, i: number) => {
            const evtTypeCode = entry.eventType || 'N/A';
            const evtTypeStr = eventTypeMap[String(evtTypeCode)] || `Unknown Type (${evtTypeCode})`;

            // Format occurrence time
            const occurrenceTime = formatTimestampWithTimezone(entry.createTime);

            output.push(`\nEvent #${i + 1}:`);
            output.push(`  ID: ${entry.id || 'N/A'}`);
            output.push(`  Event Type: ${evtTypeStr}`);
            output.push(`  Event Code: ${entry.eventCode || 'N/A'}`);
            output.push(`  Event Name: ${entry.eventName || 'N/A'}`);
            output.push(`  Occurrence Time: ${occurrenceTime}`);
            output.push(`  Output Parameters: ${entry.outputData || 'N/A'}`);
            output.push(`  AB ID: ${entry.abId || 'N/A'}`);
            output.push(`  Packet ID: ${entry.packetId || 'N/A'}`);
            output.push(`  Ticket: ${entry.ticket || 'N/A'}`);
            output.push(`  Extended Data: ${JSON.stringify(entry.extData || {})}`);
          });

          return {
            content: [{ type: "text", text: output.join('\n') }]
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