/* eslint-disable no-console */
import { MqttClient } from '../src';
import { TcpTransport } from '../src/transport';

const mqttClient = new MqttClient({
    transport: new TcpTransport({url: 'mqtt://broker.hivemq.com:1883'}),
});
mqttClient.$connect.subscribe(() => console.log('connected!'));
mqttClient.$warning.subscribe(w => console.log(w));
mqttClient.$error.subscribe(e => console.error(e));
mqttClient.$disconnect.subscribe(r => console.error('disconnected', r));

(async () => {
    await mqttClient.connect();
    mqttClient.listen({topic: 'mqtts/test/publish', subscribe: true}).subscribe((message) => {
        console.log(message);
    });
    await mqttClient.publish({topic: 'mqtts/test/publish', payload: 'hi :)'})
})();

setTimeout(async () => {
   await mqttClient.disconnect();
   console.log('Disconnected');
}, 60 * 1000);
