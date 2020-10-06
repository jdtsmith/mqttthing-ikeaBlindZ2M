/**
ikeaBlindZ2M - Homekit control of IKEA Blinds via Zigbee2MQTT
(c) 2020, J.D. Smith
License: Apache 2.0

A "Codec" plugin for homebridge-mqttthing, facilitating control of
IKEA Blinds via Zigbee2MQTT.  Place this file alongside your
config.json file, and add the following simple config:

{
  "accessory": "mqttthing",
  "name": "Blind Name",
  "codec": "ikeaBlindZ2M.js",
  "topicBase": "zigbee2mqtt/ikea_blind_topic"
}

This codec plugin routes around a number of issues with Zigbee2MQTT
amd Homekit control of blinds:

1. Zigbee2MQTT always sends a state update with the target state set
   as the current position immediately, which greatly confuses HomeKit
   (see https://github.com/Koenkk/zigbee2mqtt/issues/4524).  [UPDATE:
   A new setting optimistic: false can be applied to the blinds to
   avoid sending these spurious position updates.  This should be
   available in a new v1.15.X release soon, and is strongly
   encouraged.]

2. When pulling the blind open/close in Homekit (or with Watch
   interface, etc.), many new target positions are sent, sometimes
   several per second.  This interacts with the above problem to truly
   confuse Homekit, as it sees a series of out of order spurious moves
   it doesn't expect.

This codec works around these problems by rate limiting target
requests (by require a 500ms default uninterrupted dwell time; see
targetConsolidate config), and by recognizing and suppressing "clearly
wrong" position updates, such as those with too high rates of motion,
or arbitrary change of direction.

Optional config entries can include:

maxRate: The maximum rate (in %/sec) that a blind can move [default:
  4 %/sec].  Used to detect spurious location udpates from
  Zigbee2MQTT (see below).

targetConsolidate: Limit rapid-fire target setting by insisting no
  additional target is specified for this amount of time (in ms)
  afterwards before setting it (default: 500 ms).
**/

// Remove targets more than `seconds' old
function removeOldTargets(obj,seconds) {
  Object.keys(obj)
    .filter(x=>(Date.now()-obj[x])>(seconds * 1000))
    .map(x=>delete(obj[x]))
}

function init( params ) {
  let { log, config, publish, notify } = params;
  let targetPosition=null, curPosition=null,
      moveDirection=null, newTarget=false,
      recentTargets={}, moveStart=null,
      maxRate="maxRate" in config?config.maxRate:4,
      batteryLevel=null,
      targetConsolidate=config.targetConsolidate || 500
  log(`Starting Ikea Blind Zigbee2MQTT Codec for ${config.name} with topic base ${config.topicBase}`)

  config.type = "windowCovering"
  config.topics = {"getTargetPosition":config.topicBase,
		   "getBatteryLevel":config.topicBase,
		   "getCurrentPosition":config.topicBase,
		   "setTargetPosition":config.topicBase + "/set/position"}

  publish(config.topicBase+"/get/position",1) // Get an initial position
  
  function decode( message, info, output ) { 
    //log( `decoding [${info.property}] with message [${message}]` );
    msg=JSON.parse(message);
    
    if (info.property == "currentPosition") {
      if(Object.keys(recentTargets).length > 0) removeOldTargets(recentTargets,5)
      if(moveStart != null && curPosition != null && msg.position in recentTargets) {
	let delta=msg.position-curPosition, now=Date.now()
	let rate=Math.abs(delta)/(now-moveStart)*1e3
	//log(`Stepped at rate: ${rate} [${msg.position-curPosition}]`)
	if(targetPosition != null && moveDirection != null && delta!=0 &&
	   Math.sign(delta) != moveDirection) {
	  //log("Squashing incorrect targeted move direction report: ",msg.position)
	  return undefined
	} else if(maxRate>0 && rate>maxRate) {
	  //log("Squashing spurious rate report: ",msg.position)
	  return undefined
	}
      }
      // Record and set it
      curPosition=msg.position
      output(curPosition)
      
      if(targetPosition==null || moveStart==null) { // either no target yet, or moving outside Homekit
	newTarget=true
	targetPosition=curPosition
      } else if (targetPosition == curPosition) {
	moveStart=null   // no longer moving
      }
    } else if (info.property=="targetPosition") {
      if(newTarget) {
	newTarget=false
	return targetPosition
      }
      return undefined
    } else if (info.property=="batteryLevel") {
      if(batteryLevel==null || batteryLevel != msg.battery) {
	batteryLevel=msg.battery
	return batteryLevel
      }
      return undefined
    }
  }

  function encode(message, info, output) {
    //log( `encoding [${info.property}] with message [${message}]` );
    if(info.property=='targetPosition') {
      p = parseInt(message)
      newTarget = (targetPosition != p)
      if(newTarget) {
	moveStart=Date.now()
	setTimeout(() => { 	// Consolidate requests over 500ms
	  let d=Date.now()
	  if((d-moveStart) >= targetConsolidate-5) {
	    log(`Got new target position: ${message} (${d-moveStart})`)
	    recentTargets[p]=d
	    targetPosition = p
	    if(curPosition != null) {
	      moveDirection=Math.sign(targetPosition-curPosition)
	      if (moveDirection == 0) moveDirection=null
	    } else {
	      moveDirection=null
	    }
	    output(message)	// Send it out to make it happen
	  }
	  //else {
	    //log(`Blocking overly rapid target setting: ${message} (${d-moveStart})`)
	  //}
	},targetConsolidate)
      }
      return undefined		
    }
  }
  return {decode,encode}
}

// export initialisation function
module.exports = {
    init
};
