class panX extends AudioWorkletProcessor {

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
	let leftChannelParameter = parameters.leftChannel;
	let rightChannelParameter = parameters.rightChannel;
    let leftOutputChannel = output[Math.floor(leftChannelParameter[0])];
    let rightOutputChannel = output[Math.floor(rightChannelParameter[0])];

    let leftInputChannel = input[0];
    let rightInputChannel = input[1];

    let gain = parameters.gain;
    // console.log("L " + leftChannelParameter[0] + " R " + rightChannelParameter[0]);
    for (let i = 0; i < leftInputChannel.length; ++i) {
      leftOutputChannel[i] = leftInputChannel[i] * gain[i];
    }
	
	for (let i = 0; i < rightInputChannel.length; ++i) {
      rightOutputChannel[i] = rightInputChannel[i] * gain[i];
    }


    return true;
  }//process
}//panX
registerProcessor('panX', panX);