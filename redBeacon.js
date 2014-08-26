var app = require('http').createServer(handler);
var io = require('socket.io').listen(app);
var fs = require('fs');
var b = require('bonescript');
var notifier = require('mail-notifier');

app.listen(8081);
console.log('Server running on: http://' + getIPAddress() + ':8081');

var beacon = {
    pin: "P8_13",
    pinState: 0,
    light: false,
};

b.pinMode(beacon.pin, 'out');
b.digitalWrite(beacon.pin, beacon.pinState);

var settings = {
    imap: {
        username: "email@gmail.com",
        password: "password",
        host: "imap.gmail.com",
        port: 993, // imap port
        tls: true, // use secure connection
        tlsOptions: {
            rejectUnauthorized: false
        }
    },
    triggers: {
        on: "on",
        off: "off"
    }
};

var ntr = notifier(settings.imap);

var processMail = function(settings) {
    ntr.stop();
    ntr = notifier(settings.imap);
    ntr.on('mail', function(mail) {
        io.sockets.emit('email', mail);
        var subject = mail.subject.toLowerCase();
        
        if (subject.indexOf(settings.triggers.on.toLowerCase()) > -1) {
            toggleBeacon(true);
        }
        if (subject.indexOf(settings.triggers.off.toLowerCase()) > -1) {
            toggleBeacon(false);
        }
    });
    ntr.start();
}

processMail(settings);

function handler(req, res) {
    console.log('handler requested');
    fs.readFile('redBeacon.html',
    function(err, data) {
        if (err) {
            res.writeHead(500);
            return res.end('Error loading index.html');
        }
        res.writeHead(200);
        res.end(data);
    });
}

var toggleBeacon = function(state) {
    io.sockets.emit('beacon', { light: state });
    if (state == true) {
        beacon.pinState = 1;
        b.digitalWrite(beacon.pin, beacon.pinState);
    }
    else if (state == false) {
        beacon.pinState = 0;
        b.digitalWrite(beacon.pin, beacon.pinState);
    }
}

io.sockets.on('connection', function(socket) {
    socket.on('beacon', function(state) {
        toggleBeacon(state);
    });

    socket.on('settings', function(settings) {
        try {
            console.log(settings)
            processMail(settings);
        } catch (ex) {
            console.log(ex);
        }
    });
    beacon.light = beacon.pinState == 1;
    socket.emit('beacon', beacon);
});

// Get server IP address on LAN
function getIPAddress() {
    var interfaces = require('os').networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) return alias.address;
        }
    }
    return '0.0.0.0';
}