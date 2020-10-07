# MQTTS (MQTT Typescript)

MQTTS is a MQTT library. It currently supports _MQTT 3.1.1_ but may
support MQTT 5 in the future.

These are the key features:

-   Multiple Transports (**TLS**, **TCP**, more to come)
-   Focus On Extensibility
-   Written in Typescript
-   Parameterized listeners: `devices/:name/color` will also give you any object with the properties:
    `{name: '...'}`

**Check out the [example](examples/example.ts).**
