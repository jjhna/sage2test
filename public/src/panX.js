class panX extends AudioWorkletProcessor {

  // Custom AudioParams can be defined with this static getter.
  static get parameterDescriptors() {
    return [{ name: 'panAudioParam', defaultValue: 0 }];
  }

  constructor(dictionary) {
    super(dictionary);
    this.channelCount = dictionary.channelCount;
    this.speaker = 0;
  }

  process(inputs, outputs, parameters) {
    let input = inputs[0];
    //console.log("input . length in panx" + input.length);
    let output = outputs[0];

    let panParameter = parameters.panAudioParam;
    let rangePerSpeaker = 1.0 / output.length;
    let pan = (panParameter[0] % rangePerSpeaker);
    pan = pan / rangePerSpeaker;

    let speaker = Math.floor(panParameter[0] * output.length);
    let nextSpeaker = speaker + 1;

    //console.log("speaker" + speaker + "next" + nextSpeaker);
    for (let channel = 0; channel < output.length; ++channel) {
      if (speaker == output.length) {
        return true;
      }

      if (channel == speaker) {
        let outputChannel = output[channel];
        let inputChannel = input[channel % 2];
        for (let i = 0; i < inputChannel.length; ++i) {
          outputChannel[i] = inputChannel[i] * (1.0 - pan);
        }
      }
      else if (channel == nextSpeaker) {
        let outputChannel = output[channel];
        let inputChannel = input[channel % 2];
        for (let i = 0; i < inputChannel.length; ++i) {
          outputChannel[i] = inputChannel[i] * pan;
        }
      }
    }//for channels
    return true;
  }//process
}//panX
registerProcessor('panX', panX);