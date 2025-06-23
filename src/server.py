import os
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from iot_mcp_server import util

# Load environment variables
load_dotenv()

# Create an MCP server
mcp = FastMCP("IoT MCP Server")

@mcp.tool()
def list_products(page_size: int = 100) -> str:
    """
    List all products in the IoT platform with pagination support
    
    Args:
        page_size: Number of products per page (default: 100)
    """
    products = util.list_products(page_size=page_size)
    
    if isinstance(products, str):  # Error case
        return products
    
    if not products:
        return "No products found in your account."
    
    # Format product list with detailed information
    product_list = []
    product_list.append(f"Product list (total: {len(products)} products):")
    product_list.append("=" * 60)
    
    for i, product in enumerate(products, 1):
        # Format creation and update time
        create_time = util.format_timestamp_with_timezone(product.get('createTime'))
        update_time = util.format_timestamp_with_timezone(product.get('updateTime'))
        
        product_info = f"""
{i}. {product.get('productName', 'Unknown')}
   Product Key: {product.get('productKey', 'N/A')}
   Access Type: {util.format_access_type(product.get('accessType'))} ({product.get('accessType')})
   Network Way: {util.format_network_way(product.get('netWay'))} ({product.get('netWay')})
   Data Format: {util.format_data_fmt(product.get('dataFmt'))} ({product.get('dataFmt')})
   Connect Platform: {product.get('connectPlatform', 'N/A')}
   Logo Path: {product.get('logoPath', 'None')}
   Created Time: {create_time}
   Updated Time: {update_time}
"""
        product_list.append(product_info)
    
    return "\n".join(product_list)

@mcp.tool()
def list_products_detailed(page_size: int = 100) -> str:
    """
    List all products with detailed formatting and pagination support - shows comprehensive product information
    
    Args:
        page_size: Number of products per page (default: 100)
    """
    products = util.list_products(page_size=page_size)
    
    if isinstance(products, str):  # Error case
        return products
    
    if not products:
        return "No products found in your account."
    
    # Format product list with detailed information
    product_list = []
    product_list.append(f"Detailed Product List (total: {len(products)} products):")
    product_list.append("=" * 80)
    
    for i, product in enumerate(products, 1):
        # Format creation and update time
        create_time = util.format_timestamp_with_timezone(product.get('createTime'))
        update_time = util.format_timestamp_with_timezone(product.get('updateTime'))
        
        product_info = f"""
{i}. {product.get('productName', 'Unknown')}
   Product Key: {product.get('productKey', 'N/A')}
   Access Type: {util.format_access_type(product.get('accessType'))} ({product.get('accessType')})
   Network Way: {util.format_network_way(product.get('netWay'))} ({product.get('netWay')})
   Data Format: {util.format_data_fmt(product.get('dataFmt'))} ({product.get('dataFmt')})
   Connect Platform: {product.get('connectPlatform', 'N/A')}
   Logo Path: {product.get('logoPath', 'None')}
   Created Time: {create_time}
   Updated Time: {update_time}
   Raw Data: {product}
"""
        product_list.append(product_info)
    
    return "\n".join(product_list)

@mcp.tool()
def get_product_definition(product_key: str) -> str:
    """Get product TSL (Thing Specification Language) definition by productKey"""
    tsl_json = util.get_product_tsl_json(product_key)
    return str(tsl_json)

@mcp.tool()
def get_product_thing_model(product_id: int = None, product_key: str = None, language: str = 'CN') -> str:
    """
    Get product thing model (JSON format) by product ID or product Key
    
    Args:
        product_id: Product ID (takes precedence over product_key)
        product_key: Product Key
        language: Language setting CN/EN (default: CN)
    """
    thing_model = util.get_product_thing_model(product_id=product_id, product_key=product_key, language=language)
    return str(thing_model)

@mcp.tool()
def list_devices(product_key: str) -> str:
    """List ALL devices in a product (with automatic pagination)"""
    devices = util.list_devices(product_key)
    return str(devices)

@mcp.tool()
def list_devices_formatted(product_key: str) -> str:
    """List ALL devices with formatted time display (corrected timezone, with pagination)"""
    devices = util.list_devices_with_formatted_time(product_key)
    
    if isinstance(devices, str):  # Error case
        return devices
    
    if not devices:
        return f"No devices found for product key: {product_key}"
    
    # Format device list with correct timezone
    device_list = []
    device_list.append(f"Device list for product {product_key} (total: {len(devices)} devices):")
    device_list.append("=" * 60)
    
    for i, device in enumerate(devices, 1):
        device_info = f"""
{i}. {device.get('deviceName', 'Unknown')}
   Device Key: {device.get('deviceKey', 'N/A')}
   Product Key: {device.get('productKey', 'N/A')}
   Serial Number: {device.get('sn', 'N/A')}
   Status: {'Online' if device.get('deviceStatus') == 1 else 'Offline'} ({device.get('deviceStatus')})
   Activated: {'✓' if device.get('isActived') == 1 else '✗'} ({device.get('isActived')})
   Virtual Device: {'Yes' if device.get('isVirtual') == 1 else 'No'} ({device.get('isVirtual')})
   Verification Status: {'Verified' if device.get('isVerified') == 1 else 'Not Verified'} ({device.get('isVerified')})
   Auth Mode: {util.format_auth_mode(device.get('authMode'))} ({device.get('authMode')})
   Data Format: {util.format_data_fmt(device.get('dataFmt'))} ({device.get('dataFmt')})
   Created Time: {device.get('formattedCreateTime', 'N/A')}
   Activated Time: {device.get('formattedActivedTime', 'N/A')}
   First Connection Time: {device.get('formattedFirstConnTime', 'N/A')}
   Last Connection Time: {device.get('formattedLastConnTime', 'N/A')}
   Last Offline Time: {device.get('formattedLastOfflineTime', 'N/A')}
   Last Update: {device.get('formattedUpdateTime', 'N/A')}
   Raw Timestamps: Created={device.get('createTime')}, Activated={device.get('activedTime')}, Updated={device.get('updateTime')}, First Connection={device.get('firstConnTime')}, Last Connection={device.get('lastConnTime')}, Last Offline={device.get('lastOfflineTime')}
"""
        device_list.append(device_info)
    
    return "\n".join(device_list)

@mcp.tool()
def get_device_details(product_key: str, device_key: str) -> str:
    """Get comprehensive device details using the new detail API, including resource info like ICCID"""
    device_detail = util.get_device_detail(product_key, device_key)
    
    if isinstance(device_detail, str):
        return device_detail
    
    device_resources = util.query_device_resources(product_key, device_key)

    # Format comprehensive device information
    device_info = f"""
Device Detailed Information (Enhanced Detail API):
==========================================
Basic Information:
Device Name: {device_detail.get('deviceName', 'N/A')}
Device Key: {device_detail.get('deviceKey', 'N/A')}
Serial Number: {device_detail.get('sn', 'N/A')}
Product Key: {device_detail.get('productKey', 'N/A')}

Status Information:
Device Status: {device_detail.get('deviceStatus', 'N/A')} ({'Online' if device_detail.get('deviceStatus') == 1 else '🔴 Offline'})
Activation Status: {'Activated' if device_detail.get('isActived') == 1 else 'Not Activated'}
Verification Status: {'Verified' if device_detail.get('isVerified') == 1 else 'Not Verified'}
Virtual Device: {'Yes' if device_detail.get('isVirtual') == 1 else 'No'}

Time Information (UTC and UTC+8 timezone):
Created Time: {device_detail.get('formattedCreateTime', 'N/A')}
Activated Time: {device_detail.get('formattedActivedTime', 'N/A')}
First Connection: {device_detail.get('formattedFirstConnTime', 'N/A')}
Last Connection: {device_detail.get('formattedLastConnTime', 'N/A')}
Last Offline: {device_detail.get('formattedLastOfflineTime', 'N/A')}
Data Update: {device_detail.get('formattedUpdateTime', 'N/A')}

Technical Parameters:
Data Format: {device_detail.get('dataFmt', 'N/A')} ({'Thing Model' if device_detail.get('dataFmt') == 3 else 'Transparent Transmission'})
Auth Mode: {device_detail.get('authMode', 'N/A')} ({'Dynamic Auth' if device_detail.get('authMode') == 0 else 'Static Auth' if device_detail.get('authMode') == 1 else 'X509 Auth'})

Raw Timestamps:
Created: {device_detail.get('createTime', 'N/A')}
Activated: {device_detail.get('activedTime', 'N/A')}
First Connection: {device_detail.get('firstConnTime', 'N/A')}
Last Connection: {device_detail.get('lastConnTime', 'N/A')}
Last Offline: {device_detail.get('lastOfflineTime', 'N/A')}
Updated: {device_detail.get('updateTime', 'N/A')}
"""
    
    if isinstance(device_resources, dict) and device_resources:
        device_info += f"""
Resource Information:
ICCID: {device_resources.get('iccId', 'N/A')}
Phone Number: {device_resources.get('phoneNum', 'N/A')}
SIM Number: {device_resources.get('simNum', 'N/A')}
Battery Level: {device_resources.get('battery', 'N/A')}
Signal Strength: {device_resources.get('signalStrength', 'N/A')}
RSRP: {device_resources.get('rsrp', 'N/A')}
RSRQ: {device_resources.get('rsrq', 'N/A')}
SNR: {device_resources.get('snr', 'N/A')}
MCU Version: {device_resources.get('mcuVersion', 'N/A')}
SDK Version: {device_resources.get('sdkVer', 'N/A')}
Firmware Version: {device_resources.get('version', 'N/A')}
Voltage: {device_resources.get('voltage', 'N/A')}
Free Memory: {device_resources.get('memoryFree', 'N/A')}
Communication Protocol Version: {device_resources.get('comProtocolVer', 'N/A')}
Data Protocol Version: {device_resources.get('dataProtocolVer', 'N/A')}
Locator: {device_resources.get('locator', 'N/A')}
Log Enable: {device_resources.get('logEnable', 'N/A')}
Log Level: {device_resources.get('logLevel', 'N/A')}
Mobile Country Code (MCC): {device_resources.get('mcc', 'N/A')}
Mobile Network Code (MNC): {device_resources.get('mnc', 'N/A')}
Cell ID: {device_resources.get('cellId', 'N/A')}
Location Area Code (LAC): {device_resources.get('lac', 'N/A')}
"""
    else:
        device_info += f"""
Resource Information:
Unable to retrieve device resource information. Raw response: {device_resources}
"""
    
    return device_info

@mcp.tool()
def get_device_tsl_properties(product_key: str, device_key: str) -> str:
    """Query device TSL property data (temperature, humidity, etc.)"""
    
    # First get product TSL definition
    tsl_definition = util.get_product_tsl_json(product_key)
    
    # Then query device real-time properties
    properties_data = util.query_device_properties(product_key, device_key)
    
    info = f"""
Device TSL Property Data Query:
========================
Device Key: {device_key}
Product Key: {product_key}

TSL Definition Summary:
"""
    
    # Parse TSL definition
    if isinstance(tsl_definition, dict) and 'properties' in tsl_definition:
        properties = tsl_definition['properties']
        info += f"Supported Properties Count: {len(properties)}\n"
        info += "Property List:\n"
        for prop in properties:
            unit = prop.get('specs', {}).get('unit', '')
            info += f"  - {prop.get('name', 'N/A')} ({prop.get('code', 'N/A')}) [{unit}]\n"
    else:
        info += "Unable to get TSL definition\n"
    
    info += f"\nReal-time Property Data:\n"
    
    # Display real-time property data
    if isinstance(properties_data, dict):
        for key, value in properties_data.items():
            info += f"  - {key}: {value}\n"
    elif isinstance(properties_data, str):
        info += f"Status: {properties_data}\n"
    else:
        info += "No real-time property data\n"
    
    info += f"""
Notes:
- TSL definition shows all properties supported by the device
- Real-time data shows current property values
- If no real-time data, device may be offline or API endpoint mismatch
"""
    
    return info

@mcp.tool()
def get_device_latest_online_time(product_key: str, device_key: str) -> str:
    """Get the most accurate latest online time (enhanced with detail API)"""
    result = util.get_device_latest_online_time(product_key, device_key)
    
    info = f"""
Device Latest Online Time Analysis (Enhanced):
==================================
Device Key: {result['deviceKey']}

Data Source Comparison:
- Device Update Time: {util.format_timestamp_with_timezone(result['deviceUpdateTime']) if result['deviceUpdateTime'] else 'N/A'}
- Last Connection Time: {util.format_timestamp_with_timezone(result['lastConnTime']) if result['lastConnTime'] else 'N/A'}
- Location Service Time: {util.format_timestamp_with_timezone(result['locationTime']) if result['locationTime'] else 'N/A'}

Final Result:
- Latest Online Time: {util.format_timestamp_with_timezone(result['latestTime']) if result['latestTime'] else 'N/A'}
- Data Source: {result['source']}
- Raw Timestamp: {result['latestTime']}

Data Source Description:
- device_update: From device overview API updateTime
- last_connection: From device detail API lastConnTime (more accurate)
- location: From location service API locateTime
- System automatically selects the latest time as final result
"""
    
    return info

@mcp.tool()
def power_switch(product_key: str, device_key: str, on_off: str) -> str:
    """
    Turn the device power switch on or off
    
    Args:
        product_key: Product key identifying the product
        device_key: Device key identifying the specific device
        on_off: "on" to turn on, "off" to turn off
    """
    result = util.power_switch(product_key, device_key, on_off)
    return str(result)

@mcp.tool()
def query_device_location(product_key: str = None, device_key: str = None, device_id: int = None, language: str = 'CN') -> str:
    """
    Query latest device location data with corrected timezone
    
    Args:
        product_key: Product key (required if device_id is not provided)
        device_key: Device key (required if device_id is not provided)
        device_id: Device ID (takes precedence over product_key/device_key)
        language: Language setting CN/EN (default: CN)
    
    Returns:
        Formatted location information with correct timezone
    """
    location_data = util.query_device_location(
        product_key=product_key,
        device_key=device_key, 
        device_id=device_id,
        language=language
    )
    
    if isinstance(location_data, str):
        return location_data
    
    formatted_location = util.format_location_data(location_data)
    return formatted_location

@mcp.tool()
def get_device_location_raw(product_key: str = None, device_key: str = None, device_id: int = None, language: str = 'CN') -> str:
    """
    Get raw device location data with timezone information
    
    Args:
        product_key: Product key (required if device_id is not provided)
        device_key: Device key (required if device_id is not provided)  
        device_id: Device ID (takes precedence over product_key/device_key)
        language: Language setting CN/EN (default: CN)
    
    Returns:
        Raw location data with added timezone formatting
    """
    location_data = util.query_device_location(
        product_key=product_key,
        device_key=device_key,
        device_id=device_id, 
        language=language
    )
    
    return str(location_data)

@mcp.tool()
def query_device_resources(product_key: str, device_key: str, language: str = 'CN') -> str:
    """
    Query device resources (e.g., battery, signal strength, memory)
    
    Args:
        product_key: Product key
        device_key: Device key
        language: Language setting CN/EN (default: CN)
    """
    resources = util.query_device_resources(product_key, device_key, language)
    
    if isinstance(resources, str):
        return resources
    
    if not resources:
        return "No device resources found or an error occurred."
        
    formatted_output = []
    formatted_output.append("Device Resource Information:")
    formatted_output.append("=" * 20)
    for key, value in resources.items():
        formatted_output.append(f"{key}: {value}")
    
    return "\n".join(formatted_output)

@mcp.tool()
def get_device_data_history(
    product_key: str,
    device_key: str,
    device_id: int = None,
    begin_date_timp: int = None,
    end_date_timp: int = None,
    direction: int = None,
    language: str = 'CN',
    page_num: int = 1,
    page_size: int = 10,
    send_status: int = None
) -> str:
    """
    Query Device Historical Uplink/Downlink Data Logs.
    
    Args:
        product_key: Product Key.
        device_key: Device Key.
        device_id: Device ID (optional, takes precedence over productKey/deviceKey).
        begin_date_timp: Start time (timestamp, in milliseconds, optional).
        end_date_timp: End time (timestamp, in milliseconds, optional).
        direction: Data type: 1 - UP (uplink), 2 - DOWN (downlink) (optional).
        language: Language: CN/EN (default: CN, optional).
        page_num: Page number (default: 1, optional).
        page_size: Page size (default: 10, optional).
        send_status: Send status: 0 - Not sent; 1 - Sent; -1 - Send failed (optional).
    """
    history_data = util.query_device_data_history(
        product_key=product_key,
        device_key=device_key,
        device_id=device_id,
        begin_date_timp=begin_date_timp,
        end_date_timp=end_date_timp,
        direction=direction,
        language=language,
        page_num=page_num,
        page_size=page_size,
        send_status=send_status
    )

    if isinstance(history_data, str) and history_data.startswith("Error"):
        return history_data

    if not isinstance(history_data, dict) or "data" not in history_data:
        return f"Error: Unexpected response format from API: {str(history_data)}"

    data_entries = history_data.get("data", [])
    
    current_page_num = history_data.get('pageNum')
    if isinstance(current_page_num, dict): current_page_num = current_page_num.get('value', page_num)
    
    items_per_page = history_data.get('pageSize')
    if isinstance(items_per_page, dict): items_per_page = items_per_page.get('value', page_size)

    total_pages = history_data.get('pages')
    if isinstance(total_pages, dict): total_pages = total_pages.get('value', 'N/A')

    total_items = history_data.get('total')
    if isinstance(total_items, dict): total_items = total_items.get('value', 'N/A')


    output = [
        f"Device Historical Data Records (Device: {device_key}, Product: {product_key})",
        f"===================================================================",
        f"Pagination Info: Page {current_page_num} / Total {total_pages} pages ({items_per_page} items per page, Total {total_items} items)",
        f"-------------------------------------------------------------------"
    ]

    if not data_entries:
        output.append("No historical data found for the given criteria.")
        return "\n".join(output)

    for i, entry in enumerate(data_entries, 1):
        direction_str = "Uplink" if entry.get('direction') == 1 else \
                        "Downlink" if entry.get('direction') == 2 else \
                        f"Unknown ({entry.get('direction')})"
        
        send_status_str = "Not Sent" if entry.get('sendStatus') == 0 else \
                          "Sent" if entry.get('sendStatus') == 1 else \
                          "Send Failed" if entry.get('sendStatus') == -1 else \
                          f"Unknown ({entry.get('sendStatus')})"

        output.append(f"\nRecord #{i}:")
        output.append(f"  ID: {entry.get('id', 'N/A')}")
        output.append(f"  Direction: {direction_str}")
        output.append(f"  Message Type: {entry.get('msgType', 'N/A')}")
        output.append(f"  Data Type: {entry.get('dataType', 'N/A')}")
        
        # Format timestamps with both UTC and UTC+8
        create_time = util.format_timestamp_with_timezone(entry.get('createTime'))
        send_time = util.format_timestamp_with_timezone(entry.get('sendTime'))
        update_time = util.format_timestamp_with_timezone(entry.get('updateTime'))
        
        output.append(f"  Created Time: {create_time}")
        output.append(f"  Send Time: {send_time}")
        output.append(f"  Update Time: {update_time}")
        output.append(f"  Send Status: {send_status_str}")
        output.append(f"  Raw Data (Base64): {entry.get('data', 'N/A')}")
        output.append(f"  Thing Model Data (JSON): {entry.get('dmData', 'N/A')}")
        output.append(f"  Ticket: {entry.get('ticket', 'N/A')}")
        output.append(f"  Source Type: {entry.get('sourceType', 'N/A')}")
        output.append(f"  Extended Data: {str(entry.get('extData', {}))}")

    return "\n".join(output)

@mcp.tool()
def get_device_event_history(
    product_key: str,
    device_key: str,
    device_id: int = None,
    begin_date_timp: int = None,
    end_date_timp: int = None,
    event_type: str = None,
    language: str = 'CN',
    page_num: int = 1,
    page_size: int = 10
) -> str:
    """
    Query Device Historical Event Logs.
    
    Args:
        product_key: Product Key.
        device_key: Device Key.
        device_id: Device ID (optional, takes precedence over productKey/deviceKey).
        begin_date_timp: Start time (timestamp, in milliseconds, optional).
        end_date_timp: End time (timestamp, in milliseconds, optional).
        event_type: Event type (Offline:0, Online:1, Reconnect:2, Information:3, Alert:4, Fault:5, Reset:6, optional).
        language: Language: CN/EN (default: CN, optional).
        page_num: Page number (default: 1, optional).
        page_size: Page size (default: 10, optional).
    """
    event_history_data = util.query_device_event_history(
        product_key=product_key,
        device_key=device_key,
        device_id=device_id,
        begin_date_timp=begin_date_timp,
        end_date_timp=end_date_timp,
        event_type=event_type,
        language=language,
        page_num=page_num,
        page_size=page_size
    )

    if isinstance(event_history_data, str) and event_history_data.startswith("Error"):
        return event_history_data

    if not isinstance(event_history_data, dict) or "data" not in event_history_data:
        return f"Error: Unexpected response format from API: {str(event_history_data)}"

    data_entries = event_history_data.get("data", [])
    
    current_page_num = event_history_data.get('pageNum')
    if isinstance(current_page_num, dict): current_page_num = current_page_num.get('value', page_num)
    
    items_per_page = event_history_data.get('pageSize')
    if isinstance(items_per_page, dict): items_per_page = items_per_page.get('value', page_size)

    total_pages = event_history_data.get('pages')
    if isinstance(total_pages, dict): total_pages = total_pages.get('value', 'N/A')

    total_items = event_history_data.get('total')
    if isinstance(total_items, dict): total_items = total_items.get('value', 'N/A')

    event_type_map = {
        "0": "Offline",
        "1": "Online",
        "2": "Reconnect",
        "3": "Information",
        "4": "Alert",
        "5": "Fault",
        "6": "Reset"
    }

    output = [
        f"Device Historical Event Records (Device: {device_key}, Product: {product_key})",
        f"===================================================================",
        f"Pagination Info: Page {current_page_num} / Total {total_pages} pages ({items_per_page} items per page, Total {total_items} items)",
        f"-------------------------------------------------------------------"
    ]

    if not data_entries:
        output.append("No historical event data found for the given criteria.")
        return "\n".join(output)

    for i, entry in enumerate(data_entries, 1):
        evt_type_code = entry.get('eventType', 'N/A')
        evt_type_str = event_type_map.get(str(evt_type_code), f"Unknown Type ({evt_type_code})")

        output.append(f"\nEvent #{i}:")
        output.append(f"  ID: {entry.get('id', 'N/A')}")
        output.append(f"  Event Type: {evt_type_str}")
        output.append(f"  Event Code: {entry.get('eventCode', 'N/A')}")
        output.append(f"  Event Name: {entry.get('eventName', 'N/A')}")
        
        # Format occurrence time with both UTC and UTC+8
        occurrence_time = util.format_timestamp_with_timezone(entry.get('createTime'))
        output.append(f"  Occurrence Time: {occurrence_time}")
        
        output.append(f"  Output Parameters: {entry.get('outputData', 'N/A')}")
        output.append(f"  AB ID: {entry.get('abId', 'N/A')}")
        output.append(f"  Packet ID: {entry.get('packetId', 'N/A')}")
        output.append(f"  Ticket: {entry.get('ticket', 'N/A')}")
        output.append(f"  Extended Data: {str(entry.get('extData', {}))}")

    return "\n".join(output)

@mcp.tool()
def greet(name: str) -> str:
    """Greet a person by name"""
    return f"It is an awesome world, isn't it? {name}"

@mcp.tool()
def health_check() -> str:
    """Check if the IoT MCP server is running properly"""
    try:
        # Test if we can get access token
        token = util.get_access_token()
        if token and not token.startswith("Error"):
            return "IoT MCP Server is healthy and ready to serve requests"
        else:
            return f"IoT MCP Server has authentication issues: {token}"
    except Exception as e:
        return f"IoT MCP Server health check failed: {str(e)}"

@mcp.tool()
def get_device_latest_properties(product_key: str, device_key: str, property_filter: str = None) -> str:
    """
    Get device latest property values quickly (optimized for user experience)
    
    Args:
        product_key: Product key
        device_key: Device key  
        property_filter: Optional filter for specific properties (e.g., "temperature", "humidity", "all")
    
    Returns:
        Formatted latest property values with timestamps
    """
    try:
        # Get product TSL definition dynamically
        tsl_definition = util.get_product_tsl_json(product_key)
        
        output = [
            f"Device Latest Properties (Quick Summary)",
            f"========================================",
            f"Device Key: {device_key}",
            f"Product Key: {product_key}",
            f"",
        ]
        
        # Parse TSL definition to get available properties
        if isinstance(tsl_definition, dict) and 'properties' in tsl_definition:
            properties = tsl_definition['properties']
            output.append(f"📊 Available Properties for this Device ({len(properties)} properties):")
            output.append("")
            
            for prop in properties:
                if isinstance(prop, dict):
                    prop_name = prop.get('name', 'Unknown')
                    prop_code = prop.get('code', 'unknown')
                    prop_id = prop.get('id', 'N/A')
                    data_type = prop.get('dataType', 'UNKNOWN')
                    
                    # Get unit from specs
                    specs = prop.get('specs', {})
                    unit = ''
                    if isinstance(specs, dict):
                        unit = specs.get('unit', '')
                    elif isinstance(specs, list):
                        unit = ''  # STRUCT type typically has list specs
                    
                    output.append(f"🔹 {prop_name} ({prop_code})")
                    output.append(f"   ├─ Type: {data_type}")
                    output.append(f"   ├─ Unit: {unit}")
                    output.append(f"   └─ Property ID: {prop_id}")
                    output.append("")
        else:
            output.append("⚠️ Unable to retrieve TSL definition for this product.")
            output.append("")
        
        # Get latest property values using the optimized function
        latest_properties_result = util.get_property_summary_quick(product_key, device_key)
        
        if isinstance(latest_properties_result, dict) and latest_properties_result.get('success'):
            combined_properties = latest_properties_result.get('combined_properties', {})
            
            if combined_properties:
                output.append("📋 Latest Property Values:")
                output.append("")
                
                for prop_id, prop_data in combined_properties.items():
                    prop_name = prop_data.get('name', f'Property {prop_id}')
                    latest_value = prop_data.get('latest_value')
                    unit = prop_data.get('unit', '')
                    formatted_time = prop_data.get('formatted_time', 'N/A')
                    
                    if latest_value is not None:
                        unit_str = f" {unit}" if unit else ""
                        output.append(f"   - {prop_name}: {latest_value}{unit_str}")
                        output.append(f"     └─ Updated: {formatted_time}")
                    else:
                        output.append(f"   - {prop_name}: No recent data")
                    output.append("")
            else:
                output.append("📋 No recent property values found.")
                output.append("")
        else:
            output.append("📋 Unable to retrieve latest property values.")
            output.append("")
        
        output.append("💡 To get more detailed historical data, use:")
        output.append(f'   get_device_data_history(product_key="{product_key}", device_key="{device_key}", direction=1, page_size=10)')
        
        return "\n".join(output)
        
    except Exception as e:
        return f"Error retrieving device properties: {str(e)}"

# Startup code
if __name__ == "__main__":
    print("Starting Enhanced IoT MCP Server...")
    print("New Features:")
    print("  - Device detail API integration")
    print("  - TSL property data queries") 
    print("  - Historical data analysis")
    print("  - Enhanced online time detection")
    print("")
    print("Available tools:")
    print("- list_products: List all products")
    print("- get_product_definition: Get product TSL definition")
    print("- get_product_thing_model: Get product thing model (JSON format)")
    print("- list_devices: List ALL devices (automatic pagination)")
    print("- list_devices_formatted: List devices with timezone correction")
    print("- get_device_details: Comprehensive device details (Enhanced API)")
    print("- get_device_tsl_properties: Query TSL properties (temperature, humidity)")
    print("- get_device_latest_online_time: Most accurate online time")
    print("- power_switch: Control device power")
    print("- query_device_location: Get device location (timezone corrected)")
    print("- get_device_location_raw: Get raw location data")
    print("- query_device_resources: Query device resources")
    print("- greet: Greet a person")
    print("- health_check: Check server health")
    print("- get_device_latest_properties: Get device latest property values")
    
    mcp.run()