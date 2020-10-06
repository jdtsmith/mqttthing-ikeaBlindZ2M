# mqttthing-ikeaBlindZ2M
A Codec for [homebridge-mqttthing](https://github.com/arachnetech/homebridge-mqttthing) supporting Ikea blinds via [Zigbee2MQTT](https://github.com/Koenkk/zigbee2mqtt)

This simple codec supports operating IKEA blinds (like Fytur) using Zigbee2MQTT to translate commands to and from the blinds into MQTT messages, which mqttthing receives, and this codec encodes and decodes.  Specifically, this codec handles:

- Rate limiting new position targets, as when sliding the blinds up and down in Home or Watch interface
- Working around Zigbee2MQTT's default behavior of "optimistically" and immediately publishing the target position as the current position. New versions of Zigbee2MQTT will include the option to set `optimistic: false` for a device to disable this, and this is strongly recommended (see [this discussion](https://github.com/Koenkk/zigbee2mqtt/issues/4524)). 
- Keeping the Homekit interface in sync for moves made outside of Homekit (e.g. with remote or buttons on blinds). 

## Installation:

Installing is simply a matter of [downloading](https://github.com/jdtsmith/mqttthing-ikeaBlindZ2M/archive/main.zip), then dropping the file `ikeaBlindZ2M.js` into your `homebridge` directory (wherever the `config.json` file is).  

## Configuration:

Blinds can be configured in `config.json` as accessories:

```
{
  "accessory": "mqttthing",
  "name": "Blind Name",
  "codec": "ikeaBlindZ2M.js",
  "topicBase": "zigbee2mqtt/ikea_blind_topic",
  "maxRate": number > 0 [OPTIONAL],
  "targetConsolidate": number > 0 [OPTIONAL]
}
```

A couple of optional parameters can also be included:

```
maxRate: The maximum rate (in %/sec) that a blind can move [default:
  4 %/sec].  Used to detect spurious location udpates from
  Zigbee2MQTT (see below).

targetConsolidate: Limit rapid-fire target setting by insisting no
  additional target is specified for this amount of time (in ms)
  afterwards before setting it (default: 500 ms).
```
