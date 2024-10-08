const WebSocket = require("ws");
const request = require("request-promise");
const proxyagent = require("proxy-agent");
const fs = require("fs");

const gotaClientVersion = '3.6.4';
const botsAmount = 200;

let int = null;
let bots = [];
let gottokens = 0;

const proxy = fs.readFileSync("proxy.txt", "utf-8").split("\n");


let userSocket = null;

const initServer = () => {
    console.log("Server started")
    const Server = new WebSocket.Server({
        port: 5000
    });

    Server.on("connection", ws => {
        console.log("Client successfully connected")
        ws.on("message", msg => {
            msg = Buffer.from(msg);
            let offset = 0;
            switch (msg.readUInt8(offset++)) {
                case 0:
                    {
                        // Declare 'byte' outside the loop
                        let byte;
                        let server = "";
                        while ((byte = msg.readUInt8(offset++)) != 0) {
                            server += String.fromCharCode(byte);
                        }
                        console.log(`starting bots ${server}`)
                        startBots(server, ws);
                    } break;
                case 1:
                    {
                        destroyBots();
                    } break;
                case 2:
                    {
                        let byte;
                        let token = "";
                        let botID =  msg.readUInt8(offset++);
                        while ((byte = msg.readUInt8(offset++)) != 0) {
                            token += String.fromCharCode(byte);
                        }
                        gottokens++
                        bots[botID].sendRecaptcha(token);
                        //recaptchaTokens.addToken(token);
                    } break;
                case 3:
                    {
                        for(let i = 0; i < bots.length; i++) {
                            bots[i].split();
                        }
                    } break;
                case 4:
                    {
                        for(let i = 0; i < bots.length; i++) {
                            bots[i].eject();
                        }
                    } break;
                case 16:
                    {
                        moveBots(msg.readInt32LE(1), msg.readInt32LE(5))
                    } break;
            }
        });
        ws.on("close", e => {
            destroyBots();
        });
        ws.on("error", e => {
            destroyBots();
        });
    });
}

const startBots = (server, ws) => {
    destroyBots();
    userSocket = ws;
    for (let i = 0; i < botsAmount; i++) {
        bots.push(new bot(i, server));
    }
    let b = 0;
    int = setInterval(() => {
        let aliveBots = 0;
        for(let i = 0; i < bots.length; i++) if(!bots[i].inConnect && !bots[i].closed) aliveBots++;
        console.clear();
        console.log(`Server: ${server} | Alive Bots: ${aliveBots} | Total tokens generated: ${gottokens}`);
        b++;
        if (b > botsAmount) b = 0;
        if (bots[b] && !bots[b].inConnect && bots[b].closed) bots[b].connect();
    },  500);
}

const destroyBots = () => {
    clearInterval(int);
    for (let i = 0; i < bots.length; i++) {
        if (bots[i] && bots[i].ws) bots[i].ws.close();
    };
    bots = [];
}

const moveBots = (x, y) => {
    for (let i = 0; i < bots.length; i++) {
        bots[i].move(x, y);
    };
}

class bot {
    constructor(id, server) {
        this.id = id;
        this.ws = null;
        this.server = server;
        this.botNick = ["Nelbots", "Free bots"];
        this.inConnect = false;
        this.closed = true;
        this.int = null;
    }
    connect() {
        this.inConnect = true;
        this.ws = new WebSocket(this.server, {
            agent: new proxyagent(`http://${proxy[(~~(Math.random() * proxy.length))]}`)
        });
        this.ws.binaryType = "nodebuffer";
        this.ws.onopen = this.open.bind(this);
        this.ws.onclose = this.close.bind(this);
        this.ws.onerror = this.error.bind(this);
        this.ws.onmessage = this.message.bind(this);
    }
    open() {
        this.inConnect = false;
        this.closed = false;

        let gotaVersion = `Gota.io ${gotaClientVersion}`;
        let buf = new Buffer.alloc(3 + gotaVersion.length);
        let offset = 0;
        buf.writeUInt8(255, offset++);
        buf.writeUInt8(6, offset++);
        for(let i = 0; i < gotaVersion.length; i++) {
            buf.writeUInt8(gotaVersion.charCodeAt(i), offset++);
        }
        buf.writeUInt8(0, offset++);
        this.sendPing();

        userSocket.send(Buffer.from([0, this.id]))

        //this.sendRecaptcha();
        //this.spawn();

        this.int = setInterval(() => {
            this.sendPing();
            this.spawn();
        }, 30000);
        this.intt = setInterval(() => {
            this.spawn();
        }, 3000);
    }
    split() {
        this.send(Buffer.from([17]));
    }
    eject() {
        this.send(Buffer.from([21]));
    }
    sendPing() {
        this.send(Buffer.from([71]));
    }
    sendRecaptcha(token) {
        if (token) {
            this.sendRecaptchaResponse(token);
        } else {
            console.error("No token provided to sendRecaptcha");
            // You might want to close the connection here if a token is required
            // this.ws.close(); 
        }
    }
    spawn() {
        let nick1 = "www-nelbots-xyz";
        let nick2 = "dc-nelbots-xyz";
        let buf = new Buffer.alloc(2 + ((nick1.length + 1) * 2));
        let offset = 0;
        buf.writeUInt8(0, offset++);
        for(let i = 0; i < nick1.length; i++) {
            buf.writeUInt16LE(nick1.charCodeAt(i), offset);
            offset += 2;
        }
        buf.writeUInt16LE(0, offset);
        this.send(buf);
    }
    move(x, y) {
        let buf = new Buffer.alloc(9);
        let offset = 0;
        buf.writeUInt8(16, offset++);
        buf.writeInt32LE(x, offset);
        offset += 4;
        buf.writeInt32LE(y, offset);
        this.send(buf);
    }
    close() {
        clearInterval(this.int);
        clearInterval(this.intt);
        this.inConnect = false;
        this.closed = true;
    }
    error() {
        clearInterval(this.int);
        clearInterval(this.intt);
        this.inConnect = false;
        this.closed = true;
    }
    message(msg) {
        msg = Buffer.from(msg.data);
        let offset = 0;
        switch (msg.readUInt8(offset++)) {}
    }
    sendRecaptchaResponse(token) {
        let buf = new Buffer.alloc(2 + token.length);
        let offset = 0;
        buf.writeUInt8(100, offset++);
        for(let i = 0; i < token.length; i++) buf.writeUInt8(token.charCodeAt(i), offset++);
        buf.writeUInt8(0, offset);
        this.send(buf);
    }
    send(buf) {
        if (this.ws && this.ws.readyState == 1) this.ws.send(Buffer.from(buf));
    }
}


class tokenManager {
    constructor() {
        this.tokens = [];
        this.aliveTime = 120;
    }
    init() {
        setInterval(() => {
            this.checkExpired();
        }, 1000);
    }
    checkExpired() {
        for (let i = 0; i < this.tokens.length; i++) {
            if ((Date.now() / 1000) - this.tokens[i].date > this.aliveTime) {
                this.tokens.splice(i, 1);
            }
        }
    }
    getToken() {
        if (this.tokens.length > 0) {
            let token = this.tokens.shift();
            if (token && token.token) return token.token;
        }
        return null;
    }
    addToken(token) {
        this.tokens.push({
            date: Date.now() / 1000,
            token: token
        });
    }
}

const recaptchaTokens = new tokenManager();
initServer();