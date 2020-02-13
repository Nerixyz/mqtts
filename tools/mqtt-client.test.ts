/* eslint-disable no-console */
import { IncomingListenMessage, MqttClient, MqttMessage } from '../src';
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
    mqttClient.listen<IncomingListenMessage<any>>({topic: 'mqtts/:type/publish', subscribe: true}).subscribe(({payload, params}) => {
        console.log(payload.toString(), params);
    });
    await mqttClient.publish({topic: 'mqtts/test/publish', payload: 'hi :)'})
})();

setTimeout(async () => {
   await mqttClient.disconnect();
   console.log('Disconnected');
}, 60 * 1000);
