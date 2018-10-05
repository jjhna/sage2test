class panX extends AudioWorkletProcessor {

  // Custom AudioParams can be defined with this static getter.
  static get parameterDescriptors() {
    return [{ name: 'gain', defaultValue: 0 },
            { name: 'leftChannel', defaultValue: 0},
             {name: 'rightChannel', defaultValue: 1}];
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

    let leftOutputChannel = output[parameters.leftChannel[0]];
    let rightOutputChannel = output[parameters.rightChannel[0]];

    let leftInputChannel = input[0];
    let rightInputChannel = input[1];

    let gain = parameters.gain;
    //console.log("speaker" + speaker + "next" + nextSpeaker);
    for (let i = 0; i < leftInputChannel.length; ++i) {
      leftOutputChannel[i] = leftInputChannel[i] * gain[i];
      rightOutputChannel[i] = rightInputChannel[i] * gain[i];
    }


    return true;
  }//process
}//panX
registerProcessor('panX', panX);