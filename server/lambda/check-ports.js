const net = require('net');

// A list of commonly used ports.
const PORTS = [21, 22, 25, 80, 110, 143, 443, 587, 993, 995, 3306, 3389, 5900, 8080];

async function checkPort(port, domain) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        console.log(port, 'Init');

        socket.setTimeout(1500); // you may want to adjust the timeout

        socket.once('connect', () => {
            console.log(port, 'Connected!');
            socket.destroy();
            resolve(port);
        });

        socket.once('timeout', () => {
          console.log(port, 'Timedout');  
          socket.destroy();
        });

        socket.once('error', (e) => {
          console.log(port, 'Errored', e);
            socket.destroy();
        });

        console.log(port, 'End');
        socket.connect(port, domain);
    });
}

exports.handler = async (event, context) => {
  const domain = event.queryStringParameters.url;
  if (!domain) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing 'domain' parameter" }),
    };
  }

  const delay = ms => new Promise(res => setTimeout(res, ms));
  const timeout = delay(9000);

  const openPorts = [];
  const failedPorts = [];

  const promises = PORTS.map(port => checkPort(port, domain)
    .then(() => {
      openPorts.push(port);
      return { status: 'fulfilled', port };
    })
    .catch(() => {
      failedPorts.push(port);
      return { status: 'rejected', port };
    }));

  let timeoutReached = false;

  for (const promise of promises) {
    const result = await Promise.race([promise, timeout.then(() => ({ status: 'timeout', timeout: true }))]);
    if (result.status === 'timeout') {
      timeoutReached = true;
      if (result.timeout) {
        // Add the ports not checked yet to the failedPorts array
        const checkedPorts = [...openPorts, ...failedPorts];
        const portsNotChecked = PORTS.filter(port => !checkedPorts.includes(port));
        failedPorts.push(...portsNotChecked);
      }
      break;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ timeout: timeoutReached, openPorts, failedPorts }),
  };
};



