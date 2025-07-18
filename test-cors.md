# CORS Testing Commands

## Test 1: Basic CORS Preflight (OPTIONS request)
```bash
# Using curl (Linux/Mac/WSL)
curl -v \
  -H "Origin: https://drop.harrison-martin.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://dropapi.harrison-martin.com/login

# Using PowerShell
Invoke-WebRequest -Uri "https://dropapi.harrison-martin.com/login" -Method OPTIONS -Headers @{
  "Origin"="https://drop.harrison-martin.com"
  "Access-Control-Request-Method"="POST"
  "Access-Control-Request-Headers"="Content-Type"
} -Verbose
```

## Test 2: Simple GET request to test endpoint
```bash
# Using curl
curl -v \
  -H "Origin: https://drop.harrison-martin.com" \
  https://dropapi.harrison-martin.com/test

# Using PowerShell
Invoke-WebRequest -Uri "https://dropapi.harrison-martin.com/test" -Headers @{
  "Origin"="https://drop.harrison-martin.com"
} -Verbose
```

## Test 3: Actual login request
```bash
# Using curl
curl -v \
  -H "Origin: https://drop.harrison-martin.com" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"imageSequence":[3,7,5,9]}' \
  https://dropapi.harrison-martin.com/login

# Using PowerShell
$body = '{"imageSequence":[3,7,5,9]}'
Invoke-WebRequest -Uri "https://dropapi.harrison-martin.com/login" -Method POST -Body $body -ContentType "application/json" -Headers @{
  "Origin"="https://drop.harrison-martin.com"
} -Verbose
```

## What to look for in the response:

### Successful CORS Response Should Include:
- `Access-Control-Allow-Origin: https://drop.harrison-martin.com`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`
- `Access-Control-Allow-Credentials: true`

### Common Issues:
- **502 Bad Gateway**: Server is not running or not accessible
- **Missing CORS headers**: Server CORS configuration issue
- **Origin not allowed**: Origin not in whitelist

## Browser Console Test:
You can also test directly in your browser console from https://drop.harrison-martin.com:

```javascript
// Test basic fetch
fetch('https://dropapi.harrison-martin.com/test')
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Error:', error));

// Test login
fetch('https://dropapi.harrison-martin.com/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({imageSequence: [3, 7, 5, 9]})
})
  .then(response => response.json())
  .then(data => console.log('Login result:', data))
  .catch(error => console.error('Login error:', error));
```
