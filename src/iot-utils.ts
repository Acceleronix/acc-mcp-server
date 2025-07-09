// IoT API utilities for Cloudflare Workers
import { z } from "zod";

export interface IoTEnvironment {
  BASE_URL: string;
  ACCESS_KEY: string;
  ACCESS_SECRET: string;
}

// Pagination cursor interface
export interface PaginationCursor {
  pageNo: number;
  pageSize: number;
  productKey?: string;
  totalItems?: number;
}

// Pagination response interface
export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
}

// Encode cursor to base64 string
export function encodeCursor(cursor: PaginationCursor): string {
  const cursorStr = JSON.stringify(cursor);
  return btoa(cursorStr);
}

// Decode cursor from base64 string
export function decodeCursor(cursor: string): PaginationCursor {
  try {
    const cursorStr = atob(cursor);
    return JSON.parse(cursorStr);
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

// Global token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

export function formatTimestampWithTimezone(timestamp: number | string | null): string {
  if (!timestamp || timestamp === 0) {
    return "N/A";
  }

  try {
    const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
    const date = new Date(ts);
    
    // UTC time
    const utcTime = date.toISOString().replace('T', ' ').replace('Z', ' UTC');
    
    // UTC+8 time
    const utc8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const utc8Time = utc8Date.toISOString().replace('T', ' ').replace('Z', ' UTC+8');
    
    return `${utcTime} / ${utc8Time}`;
  } catch (error) {
    console.error(`Timestamp conversion error for ${timestamp}:`, error);
    return `Error: Invalid timestamp (${timestamp})`;
  }
}

export async function getAccessToken(env: IoTEnvironment): Promise<string> {
  // Check if current token is still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const timestamp = Date.now().toString();
  const usernameParams = {
    ver: '1',
    auth_mode: 'accessKey',
    sign_method: 'sha256',
    access_key: env.ACCESS_KEY,
    timestamp: timestamp
  };

  const usernameParamsStr = Object.entries(usernameParams)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  
  const username = encodeURIComponent(usernameParamsStr);
  
  // Generate password hash using SubtleCrypto
  const passwordPlain = `${usernameParamsStr}${env.ACCESS_SECRET}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(passwordPlain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const password = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const url = `${env.BASE_URL}/v2/quecauth/accessKeyAuthrize/accessKeyLogin?grant_type=password&username=${username}&password=${password}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const tokenData = await response.json() as any;
    accessToken = tokenData.access_token;
    
    if (!accessToken) {
      throw new Error('No access token received from API');
    }
    
    // Set expiry to 1 hour from now (tokens typically last longer)
    tokenExpiry = Date.now() + 3600000;
    
    console.log('Token obtained successfully');
    return accessToken;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to get access token');
  }
}

export async function listProducts(env: IoTEnvironment, pageSize: number = 100): Promise<any[]> {
  const allProducts: any[] = [];
  let pageNo = 1;
  
  while (true) {
    const url = `${env.BASE_URL}/v2/quecproductmgr/r3/openapi/products?pageSize=${pageSize}&pageNo=${pageNo}`;
    
    try {
      const token = await getAccessToken(env);
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.json() as any;
      
      if (content.code !== 200) {
        if (pageNo === 1) {
          throw new Error(content.msg || 'Unknown error');
        }
        break;
      }
      
      if (!content.data || content.data.length === 0) {
        break;
      }
      
      allProducts.push(...content.data);
      
      if (content.data.length < pageSize) {
        break;
      }
      
      pageNo++;
      
      if (pageNo > 100) { // Safety measure
        break;
      }
    } catch (error) {
      if (pageNo === 1) {
        throw error;
      }
      break;
    }
  }
  
  return allProducts;
}

// Paginated version of listProducts
export async function listProductsPaginated(
  env: IoTEnvironment, 
  cursor?: string, 
  defaultPageSize: number = 15
): Promise<PaginatedResponse<any>> {
  let pageNo = 1;
  let pageSize = defaultPageSize;
  
  // Decode cursor if provided
  if (cursor) {
    try {
      const decodedCursor = decodeCursor(cursor);
      pageNo = decodedCursor.pageNo;
      pageSize = decodedCursor.pageSize;
    } catch (error) {
      throw new Error('Invalid cursor provided');
    }
  }
  
  const url = `${env.BASE_URL}/v2/quecproductmgr/r3/openapi/products?pageSize=${pageSize}&pageNo=${pageNo}`;
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code !== 200) {
      throw new Error(content.msg || 'Unknown error');
    }
    
    const products = content.data || [];
    let nextCursor: string | undefined;
    
    // Check if there are more pages by looking at the data length
    if (products.length === pageSize) {
      // Try to get next page to see if it exists
      const nextPageUrl = `${env.BASE_URL}/v2/quecproductmgr/r3/openapi/products?pageSize=${pageSize}&pageNo=${pageNo + 1}`;
      try {
        const nextResponse = await fetch(nextPageUrl, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": token
          }
        });
        
        if (nextResponse.ok) {
          const nextContent = await nextResponse.json() as any;
          if (nextContent.code === 200 && nextContent.data && nextContent.data.length > 0) {
            nextCursor = encodeCursor({
              pageNo: pageNo + 1,
              pageSize: pageSize
            });
          }
        }
      } catch (error) {
        // Ignore errors when checking next page
      }
    }
    
    return {
      data: products,
      nextCursor
    };
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to get paginated products list');
  }
}

export async function getProductTslJson(env: IoTEnvironment, productKey: string): Promise<any> {
  const url = `${env.BASE_URL}/v2/quectsl/openapi/product/export/tslFile?productKey=${productKey}`;
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code !== 200) {
      throw new Error(content.msg || 'Unknown error');
    }
    
    return content.data;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to get product TSL definition');
  }
}

export async function getProductThingModel(
  env: IoTEnvironment,
  productId?: number,
  productKey?: string,
  language: string = 'CN'
): Promise<any> {
  const url = `${env.BASE_URL}/v2/quectsl/openapi/product/export/tslFile`;
  const params = new URLSearchParams({ language });
  
  if (productId) {
    params.append('productId', productId.toString());
  } else if (productKey) {
    params.append('productKey', productKey);
  } else {
    throw new Error('Either productId or productKey must be provided');
  }

  try {
    const token = await getAccessToken(env);
    const response = await fetch(`${url}?${params}`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code !== 200) {
      throw new Error(content.msg || 'Unknown error');
    }
    
    return content.data || {};
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to get product thing model');
  }
}

export async function listDevices(env: IoTEnvironment, productKey: string, pageSize: number = 100): Promise<any[]> {
  const allDevices: any[] = [];
  let pageNo = 1;
  
  while (true) {
    const url = `${env.BASE_URL}/v2/devicemgr/r3/openapi/product/device/overview?productKey=${productKey}&pageSize=${pageSize}&pageNo=${pageNo}`;
    
    try {
      const token = await getAccessToken(env);
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.json() as any;
      
      if (!content.data || content.data.length === 0) {
        break;
      }
      
      allDevices.push(...content.data);
      
      if (content.data.length < pageSize) {
        break;
      }
      
      pageNo++;
      
      if (pageNo > 100) { // Safety measure
        break;
      }
    } catch (error) {
      if (pageNo === 1) {
        throw error;
      }
      break;
    }
  }
  
  return allDevices;
}

// Paginated version of listDevices
export async function listDevicesPaginated(
  env: IoTEnvironment, 
  productKey: string,
  cursor?: string, 
  defaultPageSize: number = 15
): Promise<PaginatedResponse<any>> {
  let pageNo = 1;
  let pageSize = defaultPageSize;
  
  // Decode cursor if provided
  if (cursor) {
    try {
      const decodedCursor = decodeCursor(cursor);
      pageNo = decodedCursor.pageNo;
      pageSize = decodedCursor.pageSize;
      // Validate productKey matches cursor
      if (decodedCursor.productKey && decodedCursor.productKey !== productKey) {
        throw new Error('Product key mismatch with cursor');
      }
    } catch (error) {
      throw new Error('Invalid cursor provided');
    }
  }
  
  const url = `${env.BASE_URL}/v2/devicemgr/r3/openapi/product/device/overview?productKey=${productKey}&pageSize=${pageSize}&pageNo=${pageNo}`;
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    const devices = content.data || [];
    let nextCursor: string | undefined;
    
    // Check if there are more pages by looking at the data length
    if (devices.length === pageSize) {
      // Try to get next page to see if it exists
      const nextPageUrl = `${env.BASE_URL}/v2/devicemgr/r3/openapi/product/device/overview?productKey=${productKey}&pageSize=${pageSize}&pageNo=${pageNo + 1}`;
      try {
        const nextResponse = await fetch(nextPageUrl, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": token
          }
        });
        
        if (nextResponse.ok) {
          const nextContent = await nextResponse.json() as any;
          if (nextContent.data && nextContent.data.length > 0) {
            nextCursor = encodeCursor({
              pageNo: pageNo + 1,
              pageSize: pageSize,
              productKey: productKey
            });
          }
        }
      } catch (error) {
        // Ignore errors when checking next page
      }
    }
    
    return {
      data: devices,
      nextCursor
    };
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to get paginated devices list');
  }
}

export async function getDeviceDetail(env: IoTEnvironment, productKey: string, deviceKey: string): Promise<any> {
  const url = `${env.BASE_URL}/v2/devicemgr/r3/openapi/device/detail?productKey=${productKey}&deviceKey=${deviceKey}`;
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code !== 200) {
      throw new Error(content.msg || 'Unknown error');
    }
    
    const deviceData = content.data || {};
    
    // Add formatted timestamps
    deviceData.formattedCreateTime = formatTimestampWithTimezone(deviceData.createTime);
    deviceData.formattedActivedTime = formatTimestampWithTimezone(deviceData.activedTime);
    deviceData.formattedUpdateTime = formatTimestampWithTimezone(deviceData.updateTime);
    deviceData.formattedFirstConnTime = formatTimestampWithTimezone(deviceData.firstConnTime);
    deviceData.formattedLastConnTime = formatTimestampWithTimezone(deviceData.lastConnTime);
    deviceData.formattedLastOfflineTime = formatTimestampWithTimezone(deviceData.lastOfflineTime);
    
    return deviceData;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to get device detail');
  }
}

export async function powerSwitch(env: IoTEnvironment, productKey: string, deviceKey: string, onOff: string): Promise<string> {
  const url = `${env.BASE_URL}/v2/deviceshadow/r3/openapi/dm/writeData`;
  
  // Map on/off to TSL model Open/Close values
  const switchState = onOff.toLowerCase() === 'on' ? 'true' : 'false';
  
  const requestBody = {
    data: `[{"FAN_SWITCH":"${switchState}"}]`,
    devices: [deviceKey],
    productKey: productKey
  };
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code === 200 && content.data?.[0]?.code === 200) {
      const action = onOff.toLowerCase() === 'on' ? 'Open' : 'Close';
      return `Success: FAN_SWITCH set to ${action} (${switchState})`;
    } else {
      throw new Error(content.msg || 'Unknown error');
    }
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to control device power');
  }
}

export async function fanMode(env: IoTEnvironment, productKey: string, deviceKey: string, mode: string): Promise<string> {
  const url = `${env.BASE_URL}/v2/deviceshadow/r3/openapi/dm/writeData`;
  
  // Map mode names to TSL model values
  const modeMapping: { [key: string]: string } = {
    'low': '1',
    'medium': '2',
    'high': '3',
    '1': '1',
    '2': '2',
    '3': '3'
  };
  
  const normalizedMode = mode.toLowerCase().trim();
  const modeValue = modeMapping[normalizedMode];
  
  if (!modeValue) {
    throw new Error(`Invalid fan mode: ${mode}. Valid modes are: low, medium, high (or 1, 2, 3)`);
  }
  
  const requestBody = {
    data: `[{"FAN_MODE":"${modeValue}"}]`,
    devices: [deviceKey],
    productKey: productKey
  };
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code === 200 && content.data?.[0]?.code === 200) {
      const modeNames = { '1': 'Low speed', '2': 'Medium speed', '3': 'High speed' };
      const modeName = modeNames[modeValue as keyof typeof modeNames];
      return `Success: FAN_MODE set to ${modeName} (${modeValue})`;
    } else {
      throw new Error(content.msg || 'Unknown error');
    }
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to control fan mode');
  }
}

export async function queryDeviceLocation(
  env: IoTEnvironment,
  productKey?: string,
  deviceKey?: string,
  deviceId?: number,
  language: string = 'CN'
): Promise<any> {
  if (!deviceId && (!productKey || !deviceKey)) {
    throw new Error('Either device_id or both product_key and device_key must be provided');
  }
  
  const params = new URLSearchParams({ language });
  if (deviceId) {
    params.append('deviceId', deviceId.toString());
  } else {
    params.append('productKey', productKey!);
    params.append('deviceKey', deviceKey!);
  }
  
  const url = `${env.BASE_URL}/v2/deviceshadow/r1/openapi/device/getlocation?${params}`;
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code !== 200) {
      throw new Error(content.msg || 'Unknown error');
    }
    
    const locationData = content.data || {};
    
    // Add formatted location time
    if (locationData.locateTime) {
      locationData.formattedLocateTime = formatTimestampWithTimezone(locationData.locateTime);
    }
    
    return locationData;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to query device location');
  }
}

export async function queryDeviceResources(
  env: IoTEnvironment,
  productKey: string,
  deviceKey: string,
  language: string = 'CN'
): Promise<any> {
  const url = `${env.BASE_URL}/v2/deviceshadow/r2/openapi/device/resource`;
  const params = new URLSearchParams({
    productKey,
    deviceKey,
    language
  });
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(`${url}?${params}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code !== 200) {
      throw new Error(content.msg || 'Unknown error');
    }
    
    return content.data || {};
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to query device resources');
  }
}

// Helper formatting functions
export function formatAccessType(accessTypeCode: number): string {
  switch (accessTypeCode) {
    case 0: return "Direct Device";
    case 1: return "Gateway Device";
    case 2: return "Gateway Sub-device";
    default: return `Unknown (${accessTypeCode})`;
  }
}

export function formatNetworkWay(networkWayCode: string): string {
  switch (networkWayCode) {
    case '1': return "WiFi";
    case '2': return "Cellular (2G/3G/4G/5G)";
    case '3': return "NB-IoT";
    case '4': return "LoRa";
    case '5': return "Ethernet";
    case '6': return "Other";
    default: return networkWayCode ? `Unknown (${networkWayCode})` : "Not Specified";
  }
}

export function formatDataFmt(dataFmtCode: number): string {
  switch (dataFmtCode) {
    case 0: return "Transparent Transmission";
    case 3: return "Thing Model";
    default: return `Unknown (${dataFmtCode})`;
  }
}

export function formatAuthMode(authModeCode: number): string {
  switch (authModeCode) {
    case 0: return "Dynamic Auth";
    case 1: return "Static Auth";
    case 2: return "X509 Auth";
    default: return `Unknown (${authModeCode})`;
  }
}

export async function readDeviceData(
  env: IoTEnvironment,
  productKey: string,
  deviceKey: string,
  properties: string[],
  options: {
    cacheTime?: number;
    isCache?: boolean;
    isCover?: boolean;
    qos?: number;
    language?: string;
  } = {}
): Promise<any> {
  const url = `${env.BASE_URL}/v2/deviceshadow/r3/openapi/dm/readData`;
  
  const {
    cacheTime = 600,
    isCache = false,
    isCover = false,
    qos = 1,
    language = 'CN'
  } = options;
  
  const requestBody = {
    cacheTime,
    data: JSON.stringify(properties),
    devices: [deviceKey],
    isCache,
    isCover,
    productKey,
    qos
  };
  
  const params = new URLSearchParams({ language });
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    if (content.code !== 200) {
      throw new Error(content.msg || 'Unknown error');
    }
    
    return content.data || [];
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to read device data');
  }
}

export async function queryDeviceDataHistory(
  env: IoTEnvironment,
  productKey: string,
  deviceKey: string,
  options: {
    deviceId?: number;
    beginDateTimp?: number;
    endDateTimp?: number;
    direction?: number;
    language?: string;
    pageNum?: number;
    pageSize?: number;
    sendStatus?: number;
  } = {}
): Promise<any> {
  const url = `${env.BASE_URL}/v2/quecdatastorage/r1/openapi/device/data/history`;
  
  const {
    deviceId,
    beginDateTimp,
    endDateTimp,
    direction,
    language = 'CN',
    pageNum = 1,
    pageSize = 10,
    sendStatus
  } = options;
  
  const params = new URLSearchParams({
    productKey,
    deviceKey,
    language,
    pageNum: pageNum.toString(),
    pageSize: pageSize.toString()
  });
  
  if (deviceId !== undefined) {
    params.append('deviceId', deviceId.toString());
  }
  if (beginDateTimp !== undefined) {
    params.append('beginDateTimp', beginDateTimp.toString());
  }
  if (endDateTimp !== undefined) {
    params.append('endDateTimp', endDateTimp.toString());
  }
  if (direction !== undefined) {
    params.append('direction', direction.toString());
  }
  if (sendStatus !== undefined) {
    params.append('sendStatus', sendStatus.toString());
  }
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(`${url}?${params}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    // Handle different code formats as seen in Python implementation
    const apiCode = content.code;
    if (typeof apiCode === 'object' && Object.keys(apiCode).length === 0) {
      // Empty object code, assume success if data exists
      if (!content.data) {
        throw new Error(content.msg || 'Unknown API error with empty code object');
      }
    } else if (typeof apiCode === 'number' && apiCode !== 200) {
      throw new Error(content.msg || 'Unknown error');
    } else if (typeof apiCode !== 'number' && !(typeof apiCode === 'object' && Object.keys(apiCode).length === 0)) {
      // Unexpected code format
      if (!content.data) {
        throw new Error(`API response has unexpected code format: ${apiCode}`);
      }
    }
    
    return content;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to query device data history');
  }
}

export async function queryDeviceEventHistory(
  env: IoTEnvironment,
  productKey: string,
  deviceKey: string,
  options: {
    deviceId?: number;
    beginDateTimp?: number;
    endDateTimp?: number;
    eventType?: string;
    language?: string;
    pageNum?: number;
    pageSize?: number;
  } = {}
): Promise<any> {
  const url = `${env.BASE_URL}/v2/quecdatastorage/r1/openapi/device/eventdata/history`;
  
  const {
    deviceId,
    beginDateTimp,
    endDateTimp,
    eventType,
    language = 'CN',
    pageNum = 1,
    pageSize = 10
  } = options;
  
  const params = new URLSearchParams({
    productKey,
    deviceKey,
    language,
    pageNum: pageNum.toString(),
    pageSize: pageSize.toString()
  });
  
  if (deviceId !== undefined) {
    params.append('deviceId', deviceId.toString());
  }
  if (beginDateTimp !== undefined) {
    params.append('beginDateTimp', beginDateTimp.toString());
  }
  if (endDateTimp !== undefined) {
    params.append('endDateTimp', endDateTimp.toString());
  }
  if (eventType !== undefined) {
    params.append('eventType', eventType);
  }
  
  try {
    const token = await getAccessToken(env);
    const response = await fetch(`${url}?${params}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.json() as any;
    
    // Handle different code formats as seen in Python implementation
    const apiCode = content.code;
    if (typeof apiCode === 'object' && Object.keys(apiCode).length === 0) {
      // Empty object code, assume success if data exists
      if (!content.data) {
        throw new Error(content.msg || 'Unknown API error with empty code object');
      }
    } else if (typeof apiCode === 'number' && apiCode !== 200) {
      throw new Error(content.msg || 'Unknown error');
    } else if (typeof apiCode !== 'number' && !(typeof apiCode === 'object' && Object.keys(apiCode).length === 0)) {
      // Unexpected code format
      if (!content.data) {
        throw new Error(`API response has unexpected code format: ${apiCode}`);
      }
    }
    
    return content;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to query device event history');
  }
}