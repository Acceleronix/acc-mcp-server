import os
import time
import hashlib
import urllib.parse
import requests
import jwt
from datetime import datetime, timezone, timedelta

# Set target timezone (using UTC as base, then provide both UTC and UTC+8)
TARGET_TIMEZONE = timezone.utc

def format_timestamp_with_timezone(timestamp, show_both_timezones=True):
    """
    Unified timestamp formatting function for timezone conversion
    
    Args:
        timestamp: Unix timestamp (milliseconds)
        show_both_timezones: If True, returns both UTC and UTC+8 times
        
    Returns:
        Formatted time string with both UTC and UTC+8 if show_both_timezones=True
    """
    if not timestamp or timestamp == 0:
        return "N/A"
    
    try:
        # Ensure timestamp is a number
        if isinstance(timestamp, str):
            timestamp = float(timestamp)
        
        # Convert to datetime object (UTC time)
        dt_utc = datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc)
        # Convert to UTC+8 timezone
        dt_utc8 = dt_utc.astimezone(timezone(timedelta(hours=8)))
        
        if show_both_timezones:
            # Format output with both timezones
            utc_str = dt_utc.strftime('%Y-%m-%d %H:%M:%S UTC')
            utc8_str = dt_utc8.strftime('%Y-%m-%d %H:%M:%S UTC+8')
            return f"{utc_str} / {utc8_str}"
        else:
            # Return only UTC+8 for backward compatibility
            return dt_utc8.strftime('%Y-%m-%d %H:%M:%S')
    except Exception as e:
        print(f"Timestamp conversion error for {timestamp}: {e}")
        # Return a fallback formatted error instead of raw timestamp
        return f"Error: Invalid timestamp ({timestamp})"

def format_timestamp_detailed(timestamp):
    """
    Detailed timestamp formatting with UTC and UTC+8 in separate fields
    
    Args:
        timestamp: Unix timestamp (milliseconds)
        
    Returns:
        Dictionary with separate UTC and UTC+8 times
    """
    if not timestamp:
        return {"utc": "N/A", "utc8": "N/A", "raw": timestamp}
    
    try:
        # Convert to datetime object (UTC time)
        dt_utc = datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc)
        # Convert to UTC+8 timezone
        dt_utc8 = dt_utc.astimezone(timezone(timedelta(hours=8)))
        
        return {
            "utc": dt_utc.strftime('%Y-%m-%d %H:%M:%S UTC'),
            "utc8": dt_utc8.strftime('%Y-%m-%d %H:%M:%S UTC+8'),
            "raw": timestamp
        }
    except Exception as e:
        print(f"Timestamp conversion error: {e}")
        return {"utc": f"Error: {e}", "utc8": f"Error: {e}", "raw": timestamp}

def get_access_token():
    """Check if current token exists and is valid (not expired or expiring within 1 hour)"""
    access_token = os.environ.get('ACCESS_TOKEN')
    
    if access_token:
        try:
            # Decode token without verification to check expiration
            decoded = jwt.decode(access_token, options={"verify_signature": False})
            exp_time = decoded.get('exp')
            
            if exp_time and (exp_time - time.time() > 3600):  # More than 1 hour remaining
                return access_token
        except jwt.DecodeError:
            pass  # Token is invalid, will get new one
    
    # If we get here, either no token or it's expired/expiring soon
    access_token = _get_access_token()
    if access_token:
        os.environ['ACCESS_TOKEN'] = access_token
        return access_token
    
    print("Error: Failed to get access token")
    return None

def _get_access_token():
    """Internal method to get new access token from API"""
    access_key = os.environ.get('ACCESS_KEY')
    access_secret = os.environ.get('ACCESS_SECRET')
    
    if not access_key or not access_secret:
        return "Error: Missing ACCESS_KEY or ACCESS_SECRET"
    
    # Generate token request parameters
    timestamp = str(int(time.time() * 1000))
    username_params = {
        'ver': '1',
        'auth_mode': 'accessKey',
        'sign_method': 'sha256',
        'access_key': access_key,
        'timestamp': timestamp
    }
    username_plain = '&'.join(f"{k}={v}" for k, v in username_params.items())
    username = urllib.parse.quote(username_plain, safe="!'()*-._~")
    
    # Generate password hash
    password_plain = f"{username_plain}{access_secret}"
    password = hashlib.sha256(password_plain.encode('utf-8')).hexdigest()

    base_url = os.environ.get('BASE_URL')
    url = f"{base_url}/v2/quecauth/accessKeyAuthrize/accessKeyLogin?grant_type=password&username={username}&password={password}"

    # Make API request to get token
    try:
        response = requests.get(url, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        token_data = response.json()
        access_token = token_data.get('access_token')
        print(f"Token obtained successfully")
        return access_token
    except Exception as e:
        print(f"API Error: {str(e)}")
        return "Error: Making the accessKeyLogin request error"

def list_products(page_size=100):
    """
    List all products with pagination support
    
    Args:
        page_size: Number of products per page (default: 100)
        
    Returns:
        List of all products (automatically handles pagination)
    """
    base_url = os.environ.get('BASE_URL')
    all_products = []
    page_no = 1
    
    print(f"DEBUG: Starting product list query with page_size={page_size}")
    
    while True:
        # Add pagination parameters
        url = f"{base_url}/v2/quecproductmgr/r3/openapi/products?pageSize={page_size}&pageNo={page_no}"
        
        try:
            print(f"DEBUG: Querying page {page_no} with URL: {url}")
            response = requests.get(url, headers={
                "Content-Type": "application/json",
                "Authorization": get_access_token()
            })
            response.raise_for_status()
            content = response.json()
            
            print(f"DEBUG: Page {page_no} response code: {content.get('code')}")
            print(f"DEBUG: Page {page_no} response keys: {list(content.keys())}")
            
            if content.get('code') != 200:
                error_msg = content.get('msg', 'Unknown error')
                if page_no == 1:
                    return f"Error: {error_msg}"
                print(f"Warning: Page {page_no} returned error: {error_msg}")
                break
            
            if "data" not in content:
                print(f"Warning: No data field in API response for page {page_no}")
                break
                
            page_products = content["data"]
            print(f"DEBUG: Page {page_no} returned {len(page_products)} products")
            
            # Check for pagination info in response
            for key in ['total', 'pageInfo', 'pageSize', 'pageNo', 'totalPages', 'hasMore', 'pages']:
                if key in content:
                    print(f"DEBUG: {key}: {content.get(key)}")
            
            if not page_products or len(page_products) == 0:
                print(f"DEBUG: Page {page_no} has no products, stopping pagination")
                break
                
            all_products.extend(page_products)
            
            # If this page has fewer products than page_size, we've reached the end
            if len(page_products) < page_size:
                print(f"DEBUG: Page {page_no} has {len(page_products)} < {page_size} products, reached end")
                break
                
            page_no += 1
            
            # Safety measure to prevent infinite loops
            if page_no > 100:  
                print(f"Warning: Already queried 100 pages, stopping pagination query")
                break
                
        except Exception as e:
            print(f"API Error on page {page_no}: {str(e)}")
            if page_no == 1:
                return "Error: List products error"
            break
    
    print(f"Successfully retrieved {len(all_products)} products (total {page_no-1} pages)")
    return all_products

def get_product_tsl_json(product_key):
    """Get product TSL definition by productKey"""
    base_url = os.environ.get('BASE_URL')
    url = f"{base_url}/v2/quectsl/openapi/product/export/tslFile?productKey={product_key}"
    try:
        response = requests.get(url, headers={
            "Content-Type": "application/json",
            "Authorization": get_access_token()
        })
        response.raise_for_status()
        content = response.json()
        return content["data"]
    except Exception as e:
        print(f"API Error: {str(e)}")
        return "Error: Making the tslFile request error"

def get_product_thing_model(product_id: int = None, product_key: str = None, language: str = 'CN'):
    """
    Query Latest Product Thing Model (JSON Format)
    
    Args:
        product_id: Product ID (takes precedence over product_key)
        product_key: Product Key
        language: Language setting CN/EN (default: CN)
        
    Returns:
        dict: Product thing model data in JSON format
    """
    base_url = os.environ.get('BASE_URL')
    url = f"{base_url}/v2/quectsl/openapi/product/export/tslFile"
    
    params = {'language': language}
    if product_id:
        params['productId'] = product_id
    elif product_key:
        params['productKey'] = product_key
    else:
        return "Error: Either productId or productKey must be provided."
        
    try:
        response = requests.get(url, headers={
            "Content-Type": "application/json",
            "Authorization": get_access_token()
        }, params=params)
        response.raise_for_status()
        content = response.json()
        
        if content.get('code') != 200:
            error_msg = content.get('msg', 'Unknown error')
            return f"Error: {error_msg}"
            
        return content.get("data", {})
        
    except Exception as e:
        print(f"API Error: {str(e)}")
        return f"Error: Failed to get product thing model: {str(e)}"

def list_devices(product_key, page_size=100):
    """
    List devices in product with pagination support
    
    Args:
        product_key: Product key
        page_size: Number of devices per page (default: 100)
        
    Returns:
        List of all devices (automatically handles pagination)
    """
    base_url = os.environ.get('BASE_URL')
    all_devices = []
    page_no = 1
    
    while True:
        # Add pagination parameters
        url = f"{base_url}/v2/devicemgr/r3/openapi/product/device/overview?productKey={product_key}&pageSize={page_size}&pageNo={page_no}"
        
        try:
            response = requests.get(url, headers={
                "Content-Type": "application/json",
                "Authorization": get_access_token()
            })
            response.raise_for_status()
            content = response.json()
            
            if "data" not in content:
                print(f"Warning: No data field in API response")
                break
                
            page_devices = content["data"]
            
            if not page_devices or len(page_devices) == 0:
                break
                
            all_devices.extend(page_devices)
            
            if len(page_devices) < page_size:
                break
                
            page_no += 1
            
            if page_no > 100:  # Safety measure
                print(f"Warning: Already queried 100 pages, stopping pagination query")
                break
                
        except Exception as e:
            print(f"API Error on page {page_no}: {str(e)}")
            if page_no == 1:
                return "Error: List devices error"
            break
    
    print(f"Successfully retrieved {len(all_devices)} devices (total {page_no-1} pages)")
    return all_devices

def get_device_detail(product_key, device_key):
    """
    Get device detailed information - using new detail API
    
    Args:
        product_key: Product key
        device_key: Device key
        
    Returns:
        dict: Detailed device information, including first connection time, last online time, etc.
    """
    base_url = os.environ.get('BASE_URL')
    url = f"{base_url}/v2/devicemgr/r3/openapi/device/detail?productKey={product_key}&deviceKey={device_key}"
    
    try:
        response = requests.get(url, headers={
            "Content-Type": "application/json",
            "Authorization": get_access_token()
        })
        response.raise_for_status()
        content = response.json()
        
        if content.get('code') != 200:
            error_msg = content.get('msg', 'Unknown error')
            return f"Error: {error_msg}"
        
        device_data = content.get("data", {})
        if not device_data:
            return "No device detail found"
        
        # Add formatted time with both UTC and UTC+8
        device_data['formattedCreateTime'] = format_timestamp_with_timezone(device_data.get('createTime'))
        device_data['formattedActivedTime'] = format_timestamp_with_timezone(device_data.get('activedTime'))
        device_data['formattedUpdateTime'] = format_timestamp_with_timezone(device_data.get('updateTime'))
        device_data['formattedFirstConnTime'] = format_timestamp_with_timezone(device_data.get('firstConnTime'))
        device_data['formattedLastConnTime'] = format_timestamp_with_timezone(device_data.get('lastConnTime'))
        device_data['formattedLastOfflineTime'] = format_timestamp_with_timezone(device_data.get('lastOfflineTime'))
        
        return device_data
        
    except Exception as e:
        print(f"API Error: {str(e)}")
        return f"Error: Failed to get device detail: {str(e)}"

def query_device_properties(product_key, device_key):
    """
    Query device TSL property data
    
    Args:
        product_key: Product key
        device_key: Device key
        
    Returns:
        dict: Device property data
    """
    base_url = os.environ.get('BASE_URL')
    
    # Try different property query API endpoints
    possible_endpoints = [
        f"/v2/deviceshadow/r3/openapi/device/property",
        f"/v2/deviceshadow/r3/openapi/device/shadow", 
        f"/v2/devicedata/r3/openapi/property/get",
        f"/v2/deviceshadow/r1/openapi/device/property"
    ]
    
    for endpoint in possible_endpoints:
        url = f"{base_url}{endpoint}?productKey={product_key}&deviceKey={device_key}"
        
        try:
            response = requests.get(url, headers={
                "Content-Type": "application/json",
                "Authorization": get_access_token()
            })
            
            if response.status_code == 200:
                content = response.json()
                if content.get('code') == 200 and content.get('data'):
                    print(f"Successfully retrieved property data from endpoint: {endpoint}")
                    return content.get('data')
                    
        except Exception as e:
            print(f"Failed to try endpoint {endpoint}: {str(e)}")
            continue
    
    return "No TSL property data available from any endpoint"

def list_devices_with_formatted_time(product_key, page_size=100):
    """
    Get device list and format timestamps (with pagination support)
    """
    devices = list_devices(product_key, page_size)
    
    if isinstance(devices, str):  # Error case
        return devices
    
    # Add formatted time for each device
    for device in devices:
        device['formattedCreateTime'] = format_timestamp_with_timezone(device.get('createTime'))
        device['formattedActivedTime'] = format_timestamp_with_timezone(device.get('activedTime'))
        device['formattedUpdateTime'] = format_timestamp_with_timezone(device.get('updateTime'))
    
    return devices

def power_switch(product_key, device_key, on_off):
    """Turn the device power switch on or off"""
    base_url = os.environ.get('BASE_URL')
    url = f"{base_url}/v2/deviceshadow/r3/openapi/dm/writeData"

    # Convert 'on'/'off' to 'true'/'false'
    switch_state = 'true' if on_off.lower() == 'on' else 'false'
    
    request_body = {
        "data": f'[{{"switch":"{switch_state}"}}]',
        "devices": [device_key],
        "productKey": product_key
    }
    
    try:
        response = requests.post(
            url,
            headers={
                "Content-Type": "application/json",
                "Authorization": get_access_token()
            },
            json=request_body
        )
        response.raise_for_status()
        content = response.json()
        if content['code'] == 200 and content['data'][0]['code'] == 200:
            return "Success"
        else:
            return f"Error: {content['msg']}"
    except Exception as e:
        print(f"API Error: {str(e)}")
        return "Error: Failed to control device"

def query_device_location(product_key=None, device_key=None, device_id=None, language='CN'):
    """
    Query latest device location data with proper timezone handling
    """
    # Validate input parameters
    if not device_id and not (product_key and device_key):
        return "Error: Either device_id or both product_key and device_key must be provided"
    
    base_url = os.environ.get('BASE_URL')
    
    # Build complete URL, directly concatenate parameters
    if device_id:
        url = f"{base_url}/v2/deviceshadow/r1/openapi/device/getlocation?deviceId={device_id}&language={language}"
    else:
        url = f"{base_url}/v2/deviceshadow/r1/openapi/device/getlocation?productKey={product_key}&deviceKey={device_key}&language={language}"
    
    try:
        response = requests.get(url, headers={
            "Content-Type": "application/json", 
            "Authorization": get_access_token()
        })
        response.raise_for_status()
        content = response.json()
        
        # Check response code
        if content.get('code') != 200:
            error_msg = content.get('msg', 'Unknown error')
            return f"Error: {error_msg}"
        
        location_data = content.get("data", {})
        if not location_data:
            return "No location data found for the specified device"
        
        # Add formatted location time
        if 'locateTime' in location_data:
            location_data['formattedLocateTime'] = format_timestamp_with_timezone(location_data['locateTime'])
        
        return location_data
    except Exception as e:
        print(f"API Error: {str(e)}")
        return f"Error: API request failed: {str(e)}"

def get_device_latest_online_time(product_key, device_key):
    """
    Get device's latest online time, combining multiple data sources
    """
    result = {
        'deviceKey': device_key,
        'latestTime': None,
        'latestTimeFormatted': 'N/A',
        'source': 'unknown',
        'deviceUpdateTime': None,
        'locationTime': None,
        'lastConnTime': None,
        'detailSource': 'device_detail'
    }
    
    # 1. Get device detailed information (including lastConnTime)
    device_detail = get_device_detail(product_key, device_key)
    if isinstance(device_detail, dict):
        result['lastConnTime'] = device_detail.get('lastConnTime')
        result['deviceUpdateTime'] = device_detail.get('updateTime')
    
    # 2. Get locateTime from location information
    location_data = query_device_location(product_key=product_key, device_key=device_key)
    if isinstance(location_data, dict) and 'locateTime' in location_data:
        result['locationTime'] = location_data['locateTime']
    
    # 3. Select the latest time
    times_to_compare = []
    if result['deviceUpdateTime']:
        times_to_compare.append((result['deviceUpdateTime'], 'device_update'))
    if result['locationTime']:
        times_to_compare.append((result['locationTime'], 'location'))
    if result['lastConnTime']:
        times_to_compare.append((result['lastConnTime'], 'last_connection'))
    
    if times_to_compare:
        # Select the latest time
        latest_time, source = max(times_to_compare, key=lambda x: x[0])
        result['latestTime'] = latest_time
        result['source'] = source
        result['latestTimeFormatted'] = format_timestamp_with_timezone(latest_time)
    
    return result

def format_location_data(location_data):
    """
    Format location data for better readability with timezone correction
    """
    if isinstance(location_data, str) and location_data.startswith("Error"):
        return location_data
    
    if not isinstance(location_data, dict):
        return "Invalid location data format"
    
    formatted_info = []
    formatted_info.append(f"Device Key: {location_data.get('deviceKey', 'N/A')}")
    formatted_info.append(f"Product Key: {location_data.get('productKey', 'N/A')}")
    
    # Use fixed time formatting
    if location_data.get('locateTime'):
        formatted_time = format_timestamp_with_timezone(location_data.get('locateTime'))
        formatted_info.append(f"Location Time: {formatted_time}")
    else:
        formatted_info.append(f"Location Time: N/A")
    
    formatted_info.append(f"Location Status: {location_data.get('locateStatus', 'N/A')}")
    
    # Coordinate information
    if location_data.get('wgsLat') and location_data.get('wgsLng'):
        formatted_info.append(f"WGS84 Coordinates: {location_data.get('wgsLat')}, {location_data.get('wgsLng')}")
    
    if location_data.get('gcjLat') and location_data.get('gcjLng'):
        formatted_info.append(f"GCJ02 Coordinates: {location_data.get('gcjLat')}, {location_data.get('gcjLng')}")
    
    if location_data.get('bdLat') and location_data.get('bdLng'):
        formatted_info.append(f"BD09 Coordinates: {location_data.get('bdLat')}, {location_data.get('bdLng')}")
    
    # Additional location info
    if location_data.get('accuracy'):
        formatted_info.append(f"Accuracy: {location_data.get('accuracy')}")
    
    if location_data.get('speed'):
        formatted_info.append(f"Speed: {location_data.get('speed')}")
    
    if location_data.get('height'):
        formatted_info.append(f"Height: {location_data.get('height')}")
    
    if location_data.get('satellites'):
        formatted_info.append(f"Satellites: {location_data.get('satellites')}")
    
    return "\n".join(formatted_info)

def query_device_resources(product_key: str, device_key: str, language: str = 'CN'):
    """
    Query device resources using the OpenAPI interface.

    Args:
        product_key: Product key
        device_key: Device key
        language: Language setting CN/EN (default: CN)

    Returns:
        dict: Device resource data
    """
    base_url = os.environ.get('BASE_URL')
    url = f"{base_url}/v2/deviceshadow/r2/openapi/device/resource"

    params = {
        'productKey': product_key,
        'deviceKey': device_key,
        'language': language
    }

    try:
        response = requests.get(url, headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": get_access_token()
        }, params=params)
        response.raise_for_status() # Raises an HTTPError for bad responses (4XX or 5XX)
        content = response.json()
        print(f"DEBUG: query_device_resources API response from util.py: {content!r}")

        if content.get('code') != 200:
            error_msg = content.get('msg', 'Unknown API error')
            print(f"DEBUG: query_device_resources API error - Code: {content.get('code')}, Msg: {error_msg}")
            return f"Error from API ({content.get('code')}): {error_msg}"

        data_payload = content.get("data")
        if data_payload is None:
            print(f"DEBUG: query_device_resources API response has 'data' as None or not present. Full content: {content!r}")
            return {} # Return empty dict if data is None, signifying no specific resource data found
        return data_payload

    except requests.exceptions.HTTPError as e:
        print(f"ERROR: HTTP Error in query_device_resources: {e}")
        if e.response is not None:
            print(f"ERROR: Response status: {e.response.status_code}, Response content: {e.response.text}")
        return f"Error: HTTP error {e.response.status_code if e.response else 'unknown'} while querying device resources: {e.response.text if e.response else str(e)}"
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Network/Request Error in query_device_resources: {e}")
        return f"Error: Failed to query device resources due to network/request issue: {str(e)}"
    except ValueError as e: # Catches JSONDecodeError
        print(f"ERROR: JSON Parsing Error in query_device_resources: {str(e)}")
        if 'response' in locals() and hasattr(response, 'text'):
            print(f"ERROR: Response text that caused JSON parsing error: {response.text}")
        return f"Error: Failed to parse JSON response from device resources API: {str(e)}"
    except Exception as e:
        print(f"ERROR: Unexpected General Error in query_device_resources: {str(e)}")
        return f"Error: An unexpected error occurred while querying device resources: {str(e)}"

def query_device_data_history(
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
):
    """
    Query Device Historical Uplink/Downlink Data Logs
    API: /v2/quecdatastorage/r1/openapi/device/data/history
    """
    base_url = os.environ.get('BASE_URL')
    url = f"{base_url}/v2/quecdatastorage/r1/openapi/device/data/history"

    params = {
        'productKey': product_key,
        'deviceKey': device_key,
        'language': language,
        'pageNum': page_num,
        'pageSize': page_size
    }
    if device_id is not None:
        params['deviceId'] = device_id
    if begin_date_timp is not None:
        params['beginDateTimp'] = begin_date_timp
    if end_date_timp is not None:
        params['endDateTimp'] = end_date_timp
    if direction is not None:
        params['direction'] = direction
    if send_status is not None:
        params['sendStatus'] = send_status

    try:
        response = requests.get(url, headers={
            "Content-Type": "application/x-www-form-urlencoded", # As per docs, though params are in URL for GET
            "Authorization": get_access_token()
        }, params=params)
        response.raise_for_status()
        content = response.json()
        
        # Assuming 'code' is an integer, typically 200 for success.
        # The API doc shows "code": {} which is unusual. Adjust if needed based on actual API behavior.
        api_code = content.get('code')
        if isinstance(api_code, dict) and not api_code: # Handles "code": {}
            # If code is an empty dict, assume success if data is present or no explicit error msg
            if "data" in content:
                 print(f"DEBUG: query_device_data_history API response code is empty dict, assuming success. Content: {content!r}")
            else: # No data and empty code dict might be an issue
                 error_msg = content.get('msg', 'Unknown API error with empty code object')
                 print(f"DEBUG: query_device_data_history API error - Code: {api_code}, Msg: {error_msg}")
                 return f"Error from API ({api_code}): {error_msg}"
        elif isinstance(api_code, int) and api_code != 200:
            error_msg = content.get('msg', 'Unknown API error')
            print(f"DEBUG: query_device_data_history API error - Code: {api_code}, Msg: {error_msg}")
            return f"Error from API ({api_code}): {error_msg}"
        # If 'code' is not an int and not an empty dict, it's an unexpected format
        elif not isinstance(api_code, int) and not (isinstance(api_code, dict) and not api_code) :
            print(f"DEBUG: query_device_data_history API response has unexpected code format. Code: {api_code}, Content: {content!r}")
            # Fallback: check for 'data' presence as a loose success indicator
            if "data" not in content:
                 return f"Error: API response has unexpected code format and no data. Code: {api_code}"


        data_payload = content.get("data")
        if data_payload is None:
            # If data is None, but pagination info suggests 0 items, it's not an error.
            # The API doc shows pageNum etc as objects {} - this is strange.
            # Assuming total is a direct integer or accessible.
            total_items = content.get('total') 
            if isinstance(total_items, dict) and not total_items : # handles "total": {}
                pass # Cannot determine total, assume it might be an empty list
            elif isinstance(total_items, int) and total_items == 0:
                return {"data": [], "pagination": content} # Return empty list and pagination info
            
            print(f"DEBUG: query_device_data_history API response has 'data' as None or not present. Full content: {content!r}")
            # Return the full content for the caller to inspect if data is missing but not an explicit error
            return content 
        
        # Return the whole content, as it includes pagination info (pageNum, pageSize, pages, total)
        return content

    except requests.exceptions.HTTPError as e:
        print(f"ERROR: HTTP Error in query_device_data_history: {e}")
        if e.response is not None:
            print(f"ERROR: Response status: {e.response.status_code}, Response content: {e.response.text}")
        return f"Error: HTTP error {e.response.status_code if e.response else 'unknown'} while querying device data history: {e.response.text if e.response else str(e)}"
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Network/Request Error in query_device_data_history: {e}")
        return f"Error: Failed to query device data history due to network/request issue: {str(e)}"
    except ValueError as e: # Catches JSONDecodeError
        print(f"ERROR: JSON Parsing Error in query_device_data_history: {str(e)}")
        if 'response' in locals() and hasattr(response, 'text'):
            print(f"ERROR: Response text that caused JSON parsing error: {response.text}")
        return f"Error: Failed to parse JSON response from device data history API: {str(e)}"
    except Exception as e:
        print(f"ERROR: Unexpected General Error in query_device_data_history: {str(e)}")
        return f"Error: An unexpected error occurred while querying device data history: {str(e)}"

def query_device_event_history(
    product_key: str,
    device_key: str,
    device_id: int = None,
    begin_date_timp: int = None,
    end_date_timp: int = None,
    event_type: str = None,
    language: str = 'CN',
    page_num: int = 1,
    page_size: int = 10
):
    """
    Query Device Historical Event Logs
    API: /v2/quecdatastorage/r1/openapi/device/eventdata/history
    """
    base_url = os.environ.get('BASE_URL')
    url = f"{base_url}/v2/quecdatastorage/r1/openapi/device/eventdata/history"

    params = {
        'productKey': product_key,
        'deviceKey': device_key,
        'language': language,
        'pageNum': page_num,
        'pageSize': page_size
    }
    if device_id is not None:
        params['deviceId'] = device_id
    if begin_date_timp is not None:
        params['beginDateTimp'] = begin_date_timp
    if end_date_timp is not None:
        params['endDateTimp'] = end_date_timp
    if event_type is not None:
        params['eventType'] = event_type

    try:
        response = requests.get(url, headers={
            "Content-Type": "application/x-www-form-urlencoded", # As per docs
            "Authorization": get_access_token()
        }, params=params)
        response.raise_for_status()
        content = response.json()

        api_code = content.get('code')
        if isinstance(api_code, dict) and not api_code: # Handles "code": {}
            if "data" in content:
                 print(f"DEBUG: query_device_event_history API response code is empty dict, assuming success. Content: {content!r}")
            else:
                 error_msg = content.get('msg', 'Unknown API error with empty code object')
                 print(f"DEBUG: query_device_event_history API error - Code: {api_code}, Msg: {error_msg}")
                 return f"Error from API ({api_code}): {error_msg}"
        elif isinstance(api_code, int) and api_code != 200:
            error_msg = content.get('msg', 'Unknown API error')
            print(f"DEBUG: query_device_event_history API error - Code: {api_code}, Msg: {error_msg}")
            return f"Error from API ({api_code}): {error_msg}"
        elif not isinstance(api_code, int) and not (isinstance(api_code, dict) and not api_code) :
            print(f"DEBUG: query_device_event_history API response has unexpected code format. Code: {api_code}, Content: {content!r}")
            if "data" not in content:
                 return f"Error: API response has unexpected code format and no data. Code: {api_code}"

        data_payload = content.get("data")
        if data_payload is None:
            total_items = content.get('total')
            if isinstance(total_items, dict) and not total_items :
                pass
            elif isinstance(total_items, int) and total_items == 0:
                return {"data": [], "pagination": content}
            
            print(f"DEBUG: query_device_event_history API response has 'data' as None or not present. Full content: {content!r}")
            return content
        
        return content

    except requests.exceptions.HTTPError as e:
        print(f"ERROR: HTTP Error in query_device_event_history: {e}")
        if e.response is not None:
            print(f"ERROR: Response status: {e.response.status_code}, Response content: {e.response.text}")
        return f"Error: HTTP error {e.response.status_code if e.response else 'unknown'} while querying device event history: {e.response.text if e.response else str(e)}"
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Network/Request Error in query_device_event_history: {e}")
        return f"Error: Failed to query device event history due to network/request issue: {str(e)}"
    except ValueError as e: # Catches JSONDecodeError
        print(f"ERROR: JSON Parsing Error in query_device_event_history: {str(e)}")
        if 'response' in locals() and hasattr(response, 'text'):
            print(f"ERROR: Response text that caused JSON parsing error: {response.text}")
        return f"Error: Failed to parse JSON response from device event history API: {str(e)}"
    except Exception as e:
        print(f"ERROR: Unexpected General Error in query_device_event_history: {str(e)}")
        return f"Error: An unexpected error occurred while querying device event history: {str(e)}"

def format_auth_mode(auth_mode_code):
    """Formats the authentication mode code into a human-readable string."""
    if auth_mode_code == 0:
        return "Dynamic Authentication"
    elif auth_mode_code == 1:
        return "Static Authentication"
    elif auth_mode_code == 2:
        return "X509 Authentication"
    return f"Unknown ({auth_mode_code})"

def format_data_fmt(data_fmt_code):
    """Formats the data format code into a human-readable string."""
    if data_fmt_code == 0:
        return "Transparent Transmission"
    elif data_fmt_code == 3:
        return "Thing Model"
    return f"Unknown ({data_fmt_code})"

def format_access_type(access_type_code):
    """Formats the access type code into a human-readable string."""
    if access_type_code == 0:
        return "Direct Device"
    elif access_type_code == 1:
        return "Gateway Device"
    elif access_type_code == 2:
        return "Gateway Sub-device"
    return f"Unknown ({access_type_code})"

def format_network_way(network_way_code):
    """Formats the network way code into a human-readable string."""
    if network_way_code == '1':
        return "WiFi"
    elif network_way_code == '2':
        return "Cellular (2G/3G/4G/5G)"
    elif network_way_code == '3':
        return "NB-IoT"
    elif network_way_code == '4':
        return "LoRa"
    elif network_way_code == '5':
        return "Ethernet"
    elif network_way_code == '6':
        return "Other"
    elif network_way_code is None:
        return "Not Specified"
    return f"Unknown ({network_way_code})"

def extract_latest_properties_from_history(product_key, device_key, max_records=30):
    """
    Efficiently extract latest property values from recent data history
    
    Args:
        product_key: Product key
        device_key: Device key
        max_records: Maximum number of recent records to analyze (default: 30)
    
    Returns:
        dict: Latest property values with metadata
    """
    try:
        # Get recent uplink data
        recent_data = query_device_data_history(
            product_key=product_key,
            device_key=device_key,
            direction=1,  # Uplink only
            page_size=max_records,
            page_num=1,
            language='CN'
        )
        
        if isinstance(recent_data, str) or not isinstance(recent_data, dict):
            return {"error": "Failed to retrieve recent data", "data": None}
        
        data_entries = recent_data.get("data", [])
        if not data_entries:
            return {"error": "No recent data entries found", "data": None}
        
        # Extract latest values for each property ID
        latest_properties = {}
        
        for i, entry in enumerate(data_entries):
            if not isinstance(entry, dict):
                print(f"DEBUG: Entry {i} is not a dict: {type(entry)} - {entry}")
                continue  # Skip non-dict entries
            create_time = entry.get('createTime', 0)
            thing_model_data = entry.get('thingModelData', '[]')
            
            try:
                import json
                parsed_data = json.loads(thing_model_data) if isinstance(thing_model_data, str) else thing_model_data
                
                if isinstance(parsed_data, list):
                    for item in parsed_data:
                        if isinstance(item, dict) and 'id' in item:
                            prop_id = item['id']
                            prop_value = item.get('value')
                            
                            # Only update if this is newer or we don't have this property yet
                            if prop_id not in latest_properties or create_time > latest_properties[prop_id]['timestamp']:
                                latest_properties[prop_id] = {
                                    'value': prop_value,
                                    'timestamp': create_time,
                                    'formatted_time': format_timestamp_with_timezone(create_time),
                                    'entry_id': entry.get('id'),
                                    'ticket': entry.get('ticket'),
                                    'raw_item': item
                                }
            except (json.JSONDecodeError, TypeError, KeyError):
                continue  # Skip invalid data
        
        return {
            "error": None,
            "data": latest_properties,
            "total_entries_analyzed": len(data_entries),
            "unique_properties_found": len(latest_properties)
        }
        
    except Exception as e:
        return {"error": f"Exception in extract_latest_properties_from_history: {str(e)}", "data": None}

def get_property_summary_quick(product_key, device_key):
    """
    Quick summary of device properties (optimized for speed)
    
    Args:
        product_key: Product key
        device_key: Device key
    
    Returns:
        dict: Quick property summary
    """
    try:
        # Get property definitions
        thing_model = get_product_thing_model(product_key=product_key, language='CN')
        property_definitions = {}
        
        if isinstance(thing_model, dict) and 'properties' in thing_model:
            for prop in thing_model['properties']:
                if isinstance(prop, dict):  # Ensure prop is a dictionary
                    prop_id = prop.get('id')
                    if prop_id is not None:
                        specs = prop.get('specs', {})
                        unit = ''
                        min_val = None
                        max_val = None
                        
                        if isinstance(specs, dict):
                            unit = specs.get('unit', '')
                            min_val = specs.get('min')
                            max_val = specs.get('max')
                        elif isinstance(specs, list):
                            unit = ''  # STRUCT type has list specs
                        
                        property_definitions[prop_id] = {
                            'name': prop.get('name', 'Unknown'),
                            'code': prop.get('code', 'unknown'),
                            'unit': unit,
                            'dataType': prop.get('dataType', 'UNKNOWN'),
                            'range': {
                                'min': min_val,
                                'max': max_val
                            }
                        }
        
        # Get latest property values
        properties_result = extract_latest_properties_from_history(product_key, device_key, max_records=20)
        
        if properties_result.get('error'):
            return {
                'success': False,
                'error': properties_result['error'],
                'property_definitions': property_definitions
            }
        
        latest_properties = properties_result.get('data', {})
        
        # Combine definitions with latest values
        combined_properties = {}
        for prop_id, prop_def in property_definitions.items():
            latest_data = latest_properties.get(prop_id)
            combined_properties[prop_id] = {
                'definition': prop_def,
                'latest_value': latest_data['value'] if latest_data else None,
                'last_updated': latest_data['formatted_time'] if latest_data else None,
                'timestamp': latest_data['timestamp'] if latest_data else None,
                'has_recent_data': latest_data is not None
            }
        
        return {
            'success': True,
            'error': None,
            'properties': combined_properties,
            'stats': {
                'total_defined_properties': len(property_definitions),
                'properties_with_data': len(latest_properties),
                'entries_analyzed': properties_result.get('total_entries_analyzed', 0)
            }
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f"Exception in get_property_summary_quick: {str(e)}",
            'properties': {}
        }