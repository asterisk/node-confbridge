'use strict';

var machina = require('machina');
var util = require('util');
var Q = require('q');
var config = require('../../../config.json');

var USER_TO_BRIDGE = 'in';
var LISTEN_VOLUME = 'VOLUME(TX)';
var TALK_VOLUME = 'VOLUME(RX)';
var PITCH_SHIFT = 'PITCH_SHIFT(RX)';

/** The channel waits in this state until the application
 *  is ready to interact with it.
 */
var inactive = {
  _onEnter: function() {
    this.printState();
  },
  ready: function() {
    this.transition('waiting');
  }
}

/**
 * The channel waits in this state until the application lets it know
 * that the conference is locked, or if a PIN code is required. Stays in
 * this state until a correct PIN is entered, or if no PIN is required,
 * it is immediately placed in the conference.
 */
var waiting = {
  _onEnter: function() {
    var self = this;
    this.printState();
    this.bridge = this.getBridge();
    this.ari = this.getAri();
    this.bridgeSettings = this.getBridgeSettings();
    this.channel = this.getChannel();
    this.userSettings = this.getUserSettings();
    if (this.bridge.locked) {
      bridgeIsLocked(this.ari, this.channel, this.bridgeSettings); 
    }
    else {
      if (!this.userSettings.pin_auth) {
        addToBridge(self, this.bridge, this.channel);
      }
      else {
        pinAuth(this.ari, this.channel, this.bridgeSettings);
      }
    }
  },
  dtmf: function(data) {
    var self = this;
    if (data.digit === config.waitingInput.verify) {
      if (parseInt(this.getDigits()) === this.bridgeSettings.pin_number) {
        addToBridge(self, this.bridge, this.channel);
      }
      else {
        invalidPin(this.ari, this.channel, this.bridgeSettings,
                   this.incrementRetries, this.getRetries, this.resetDigits);
      }
    }
    else {
      this.concatDigits(data.digit);
    }
  }
}

/**
 * While the channel is in this state, it can interact with other users in
 * the conference.
 */
var active = {
  _onEnter: function() {
    this.printState();
    this.ari = this.getAri();
    this.userSettings = this.getUserSettings();
    this.bridgeSettings = this.getBridgeSettings();
    this.channel = this.getChannel();
  },
  dtmf: function(data) {
    var self = this;
    switch (data.digit) {

      // Transition to admin menu if user has admin flag
      case config.menuInput.admin:
        if (this.userSettings.admin) {
          self.transition('admin');
        }
        break;

      // Mutes the channel
      case config.menuInput.mute:
        if (!this.getMuted()) {
          muteChannel(this.ari, this.bridgeSettings, this.channel,
                      this.setMuted);
        }
        else {
          unmuteChannel(this.ari, this.bridgeSettings, this.channel,
                        this.setMuted);
        }
        break;

      // Deaf mutes the channel
      case config.menuInput.deafMute:
        if (!this.getDeafMuted()) {
          deafMuteChannel(this.ari, this.channel, this.setMuted,
                          this.setDeafMuted);
        }
        else {
          undeafMuteChannel(this.ari, this.channel, this.setMuted,
                            this.setDeafMuted);
        }
        break;

      // Leaves the conference and executes configured dialplan
      case config.menuInput.contInDialplan:
        continueInDialplan(this.channel);
        break;

      // Decreases audio volume the channel hears
      case config.menuInput.decLisVol:
        if (this.getListenCounter() > -10) {
          modifyListenVolume(this.channel, this.getListenCounter,
                             this.decrementListenCounter);
        }
        break;

      // Resets audio volume the channel hears
      case config.menuInput.resetLisVol:
        resetListenVolume(this.channel, this.getListenCounter,
                          this.resetListenCounter);
        break;

      // Increases audio volume the channel hears
      case config.menuInput.incLisVol:
        if (this.getListenCounter() < 10) {
          modifyListenVolume(this.channel, this.getListenCounter,
                             this.incrementListenCounter);
        }
        break;

      // Decreases audio volume the channel outputs
      case config.menuInput.decTalkVol:
        if (this.getTalkCounter() > -10) {
          modifyTalkVolume(this.channel, this.getTalkCounter,
                           this.decrementTalkCounter);
        }
        break;

      // Resets audio volume the channel outputs
      case config.menuInput.resetTalkVol:
        resetTalkVolume(this.channel, this.getTalkCounter,
                        this.resetTalkCounter);
        break;

      // Increases audio volume the channel outputs
      case config.menuInput.incTalkVol:
        if (this.getTalkCounter() < 10) {
          modifyTalkVolume(this.channel, this.getTalkCounter,
                           this.incrementTalkCounter);
        }
        break;

      // Changes the pitch of the audio the channel outputs
      case config.menuInput.pitchChange:
        pitchChange(this.getPitchChanger, this.incrementPitchChanger,
                    this.resetPitchChanger, this.channel);
        break;

      // DTMF has no specified functionality
      default:
        console.log(util.format('%s is not a recognized DTMF keybind',
                    data.digit));
        break;
    } 
  }
}

/**
 * While the channel is in this state, it can interact with other users and
 * the bridge in a way unique to an admin. Only users with the admin flag
 * set to true in the database can access this state.
 */
var admin = {
  _onEnter: function() {
    this.printState();
    this.ari = this.getAri();
    this.bridge = this.getBridge();
    this.users = this.getUsers();
    this.bridgeSettings = this.getBridgeSettings();
  },
  dtmf: function (data) {
    var self = this;
    switch (data.digit) {

      // Transition back to active menu
      case config.adminInput.menu:
        self.transition('active');
        break;

      // Kick the last user that joined the conference
      case config.adminInput.kick:
        kickLast(this.ari, this.bridge, this.bridgeSettings, this.users);
        break;

      // Lock or unlock the conference
      case config.adminInput.toggleLock:
        toggleLock(this.ari, this.bridge, this.bridgeSettings);
        break;

      // Start recording, pause recording, or unpause recording
      case config.adminInput.toggleRecord:
        if (!this.bridge.recordingEnabled) {
          enableRecording(this.bridge);
        }
        else if (!this.bridge.recordingPaused) {
          pauseRecording(this.ari, this.bridge);
        }
        else {
          unpauseRecording(this.ari, this.bridge);
        }
        break;

      // DTMF has no specified functionality
      default:
        console.log(util.format('%s is not a recognized DTMF keybind',
                                data.digit));
        break;
    }
  }
}

/**
 * Lets a channel know the bridge is locked, then hangs up the channel.
 */
var bridgeIsLocked = function(ari, channel, bridgeSettings) {
  var playback = ari.Playback();
  var soundToPlay = util.format('sound:%s',
                                bridgeSettings.locked_sound);
  var play = Q.denodeify(channel.play.bind(channel));
  play({media: soundToPlay}, playback)
    .catch(function(err) {
      console.error(err);
    })
    .done();
  playback.once('PlaybackFinished', function (event, completedPlayback) {
    var hangup = Q.denodeify(channel.hangup.bind(channel));
    hangup()
      .catch(function (err) {
        console.error(err);
      })
      .done();
  });
}

/**
 * Places the channel into the bridge.
 */
var addToBridge = function(self, bridge, channel) {
  var add = Q.denodeify(bridge.addChannel.bind(bridge));
  add({channel: channel.id})
    .then(function () {
      self.transition('active');
    })
    .catch(function(err) {
      console.error(err);
    })
    .done();
}

/**
 * Asks the user to enter the PIN to the conference.
 */
var pinAuth = function(ari, channel, bridgeSettings) {
  var playback = ari.Playback();
  var soundToPlay = util.format('sound:%s',
                                bridgeSettings.enter_pin_sound);
  var play = Q.denodeify(channel.play.bind(channel));
  play({media: soundToPlay}, playback)
    .catch(function(err) {
      console.error(err);
    })
    .done();
}

/**
 * Lets the user know they entered an invallid PIN. If the maximum amount
 * of retries is reached, the channel will be hung up.
 */
var invalidPin = function(ari, channel, bridgeSettings, incrementRetries,
                          getRetries, resetDigits) {
  incrementRetries();
  var playback = ari.Playback();
  var soundToPlay = util.format('sound:%s',
                                bridgeSettings.bad_pin_sound);
  var play = Q.denodeify(channel.play.bind(channel));
  play({media: soundToPlay}, playback)
    .catch(function(err) {
      console.error(err);
    })
    .done()
  if (getRetries() > bridgeSettings.pin_retries) {
    playback.once('PlaybackFinished', function (err, completedPlayback) {
      var hangup = Q.denodeify(channel.hangup.bind(channel));
      hangup()
        .catch(function (err) {
          console.error(err);
        })
        .done();
    });
  }
  resetDigits();
}

/**
 * Kicks the last user that joined the conference from the bridge.
 */
var kickLast = function(ari, bridge, bridgeSettings, users) {
  if (bridge.lastJoined) {
    var chanId = bridge.lastJoined.pop();
    users[chanId].fsm.transition('inactive');
    var soundToPlay = util.format('sound:%s',
                                  bridgeSettings.kicked_sound);
    var remove = Q.denodeify(bridge.removeChannel.bind(bridge));
    var playback = ari.Playback();
    remove({channel: chanId})
      .then(function () {
        var play = Q.denodeify(ari.channels.play.bind(ari));
        return play({channelId: chanId, media: soundToPlay,
                     playbackId: playback.id});
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
    playback.once('PlaybackFinished', function (event,
                                                completedPlayback) {
      var hangup = Q.denodeify(ari.channels.hangup.bind(ari));
      hangup({channelId: chanId})
        .catch(function (err) {
          console.error(err);
        })
        .done();
    });
  }
}

/**
 * Toggles the lock on the bridge, determining whether or not any more users
 * can join.
 */
var toggleLock = function(ari, bridge, bridgeSettings) {
  if (!bridge.locked) {
    var playback = ari.Playback();
    var soundToPlay = util.format('sound:%s',
                                  bridgeSettings.now_locked_sound);
    var play = Q.denodeify(bridge.play.bind(bridge));
    play({media: soundToPlay}, playback)
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }
  else {
    var playback = ari.Playback();
    var soundToPlay = util.format('sound:%s',
                      bridgeSettings.now_unlocked_sound);
    var play = Q.denodeify(bridge.play.bind(bridge));
    play({media: soundToPlay}, playback)
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }
  bridge.locked = !bridge.locked;
}

/**
 * Starts recording for the bridge.
 */
var enableRecording = function(bridge) {
  var record = Q.denodeify(bridge.record.bind(bridge));
  record({format: 'wav', name: bridge.currentRecording.name,
          terminateOn: 'none'})
    .then(function() {
      console.log('Bridge is recording');
      bridge.recordingPaused = false;
      bridge.recordingEnabled = true;
    })
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Pauses the bridge recording.
 */
var pauseRecording = function(ari, bridge) {
  var pause = Q.denodeify(ari.recordings.pause.bind(ari));
  pause({recordingName: bridge.currentRecording.name})
    .then(function () {
      bridge.recordingPaused = true;
      console.log('Recording paused');
    })
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Unpauses the bridge recording.
 */
var unpauseRecording = function(ari, bridge) {
  var unpause = Q.denodeify(ari.recordings.unpause.bind(ari));
  unpause({recordingName: bridge.currentRecording.name})
    .then(function () {
      bridge.recordingPaused = false;
      console.log('Recording unpaused');
    })
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Mutes the channel.
 */
var muteChannel = function(ari, bridgeSettings, channel, setMuted) {
  var playback = ari.Playback();
  var soundToPlay = util.format('sound:%s',
                                bridgeSettings.now_muted_sound);
  var mute = Q.denodeify(channel.mute.bind(channel));
  mute({direction: USER_TO_BRIDGE})
    .then(function () {
      setMuted(true);
      var play = Q.denodeify(channel.play.bind(channel));
      return play({media: soundToPlay});
    })
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Unmutes the channel.
 */
var unmuteChannel = function(ari, bridgeSettings, channel, setMuted) {
  var playback = ari.Playback();
  var soundToPlay = util.format('sound:%s',
                                bridgeSettings.now_unmuted_sound);
  var unmute = Q.denodeify(channel.unmute.bind(channel));
  unmute({direction: USER_TO_BRIDGE})
    .then(function () {
      setMuted(false);
      var play = Q.denodeify(channel.play.bind(channel));
      return play({media: soundToPlay});
    })
    .catch(function (err) {
      console.error(err);
    })
    .done()
}

/**
 * Deafmutes the channel.
 */
var deafMuteChannel = function(ari, channel, setMuted, setDeafMuted) {
  var mute = Q.denodeify(channel.mute.bind(channel));
  mute({direction: 'both'})
    .then(function () {
      setMuted(true);
      setDeafMuted(true);
      console.log('Channel is deaf muted');
    })
    .catch(function (err) {
      console.error(err);
    })
    .done();
}


/**
 * Undeaf mutes the channel.
 */
var undeafMuteChannel = function(ari, channel, setMuted, setDeafMuted) {
  var unmute = Q.denodeify(channel.unmute.bind(channel));
  unmute({direction: 'both'})
    .then(function () {
      setMuted(false);
      setDeafMuted(false);
      console.log('Channel is no longer deaf muted');
    })
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Removes the user from the conference and sends them to the configured
 * context, extension, and priority in the dialplan.
 */
var continueInDialplan = function(channel) {
  var dialplanContinue = Q.denodeify(channel.continueInDialplan.bind(
                                     channel));
  dialplanContinue({context: config.leaveConf.context,
                    extension: config.leaveConf.extension,
                    priority: config.leaveConf.priority})
    .then(function () {
      console.log('Continuing in the dialplan');
      self.transition('inactive');
    })
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Decreases or increases the volume of the audio the channel hears.
 */
var modifyListenVolume = function(channel, getListenCounter,
                                  modifyListenCounter) {
  modifyListenCounter();
  var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
  setVar({variable: LISTEN_VOLUME, value: getListenCounter()})
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Sets the volume of the audio the channel hears back to its default.
 */
var resetListenVolume = function(channel, getListenCounter,
                                 resetListenCounter) {
  resetListenCounter();
  var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
  setVar({variable: LISTEN_VOLUME, value: getListenCounter()})
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Decreases or increases the volume of the audio the channel outputs.
 */
var modifyTalkVolume = function(channel, getTalkCounter, modifyTalkCounter) {
  modifyTalkCounter();
  var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
  setVar({variable: TALK_VOLUME, value: getTalkCounter()})
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Sets the volume of the audio the channel outputs back to its default.
 */
var resetTalkVolume = function(channel, getTalkCounter, resetTalkCounter) {
  resetTalkCounter();
  var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
  setVar({variable: TALK_VOLUME, value: getTalkCounter()})
    .catch(function (err) {
      console.error(err);
    })
    .done();
}

/**
 * Changes the pitch of the audio the channel outputs.
 */
var pitchChange = function(getPitchChanger, incrementPitchChanger,
                           resetPitchChanger, channel) {
  var pitchChanger = getPitchChanger();
  if (pitchChanger === 0) {
    var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
    setVar({variable: PITCH_SHIFT, value: 0.7})
      .then(function () {
        incrementPitchChanger();
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }
  else if (pitchChanger === 1) {
    var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
    setVar({variable: PITCH_SHIFT, value: 'higher'})
      .then(function () {
        incrementPitchChanger();
      })
      .catch(function (err) {
         console.error(err);
      })
      .done()
  }
  else {
    var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
    setVar({variable: PITCH_SHIFT, value: 1.0})
      .then(function () {
        resetPitchChanger();
      })
      .catch(function (err) {
        console.error(err);
      })
      .done()
  }
}

/**
 * Creates an fsm for a user and returns it.
 *
 * @returns fsm - the fsm to return
 */
function createFsm(channel, ari, userSettings, users, bridge, bridgeSettings) {

  // Some things to keep track of in each fsm.
  var digits = '';
  var retries = 0;
  var muted = false;
  var deafMuted = false;
  var talkCounter = 1;
  var listenCounter = 1;
  var pitchChanger = 0;

  var fsm = new machina.Fsm({

    initialState: 'inactive',

    printState: function() {
      console.log('Channel entered state', this.state);
    },

    isActive: function() {
      return this.state === 'active' || this.state === 'admin';
    },

    isInactive: function() {
      return this.state === 'inactive' || this.state === 'waiting';
    },

    getAri: function() {
      return ari;
    },

    getChannel: function() {
      return channel;
    },

    getUsers: function() {
      return users;
    },

    getUserSettings: function() {
      return userSettings;
    },

    getBridge: function() {
      return bridge;
    },

    getBridgeSettings: function() {
      return bridgeSettings;
    },

    getRetries: function() {
      return retries;
    },

    getDigits: function() {
      return digits;
    },

    incrementRetries: function() {
      retries++;
    },

    concatDigits: function(digit) {
      digits += digit;
    },

    resetDigits: function() {
      digits = '';
    },

    getMuted: function() {
      return muted;
    },

    setMuted: function(value) {
      muted = value;
    },

    getDeafMuted: function() {
      return deafMuted;
    },

    setDeafMuted: function(value) {
      deafMuted = value;
    },

    getListenCounter: function() {
      return listenCounter;
    },

    decrementListenCounter: function() {
      listenCounter--;
    },

    incrementListenCounter: function() {
      listenCounter++;
    },

    resetListenCounter: function() {
      listenCounter = 1;
    },

    getTalkCounter: function() {
      return talkCounter;
    },

    decrementTalkCounter: function() {
      talkCounter--;
    },

    incrementTalkCounter: function() {
      talkCounter++;
    },

    resetTalkCounter: function() {
      talkCounter = 1;
    },

    getPitchChanger: function() {
      return pitchChanger;
    },

    incrementPitchChanger: function() {
      pitchChanger += 1;
    },
 
    resetPitchChanger: function() {
      pitchChanger = 0;
    },

    states: {

      'inactive': inactive,

      'waiting': waiting,

      'active': active,

      'admin': admin
    }

  });

  return fsm;
}

module.exports = createFsm;
