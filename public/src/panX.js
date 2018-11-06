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
  }

  process(inputs, outputs, parameters) {
    let input = inputs[0];
    
    //console.log("input . length in panx" + input.length);
    let output = outputs[0];
	let leftChannelParameter = parameters.leftChannel;
	let rightChannelParameter = parameters.rightChannel;
	let gain = parameters.gain;
    let leftOutputChannel = output[Math.floor(leftChannelParameter[0])];
    let rightOutputChannel = output[Math.floor(rightChannelParameter[0])];

    // let leftInputChannel = input[0];
    // let rightInputChannel = input[1];

    // console.log("L " + leftOutputChannel.length + " R " + rightOutputChannel.length + "gain" + gain[0]);
	// for(let channel = 0; channel < this.channelCount; ++channel)
	// {
		output[Math.floor(leftChannelParameter[0])].set(input[0].map(v => v * gain[0]));
		output[Math.floor(rightChannelParameter[0])].set(input[1].map(v => v * gain[0]));
	// }

    return true;
  }//process
}//panX
registerProcessor('panX', panX);