import http from 'http';

http.get('http://localhost:8080/api/dispatch-logs/debug-active', (res) => {
  let data = '';
  console.log('Status Code:', res.statusCode);
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Raw Response:', data);
    try {
        console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
        console.log('Not JSON');
    }
  });
}).on('error', (err) => {
  console.error("Error: " + err.message);
});
