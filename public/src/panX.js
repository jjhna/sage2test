class panX extends AudioWorkletProcessor {

  // Custom AudioParams can be defined with this static getter.
  static get parameterDescriptors() {
    return [{ name: 'gain', defaultValue: 1 },
            { name: 'leftChannel', defaultValue: 0},
             {name: 'rightChannel', defaultValue: 1}];
  }

  constructor(dictionary) {
    super(dictionary);
    this.port.onmessage = (event) => {
        // Handling data from the node.
		this.isMono = event.data;
    };
    this.port.postMessage('Hi!');
    this.channelCount = dictionary.channelCount;
  }

  process(inputs, outputs, parameters) {
    let input = inputs[0];
    
    //console.log("input . length in panx" + input.length);
    let output = outputs[0];
	let leftChannelParameter = parameters.leftChannel;
	let rightChannelParameter = parameters.rightChannel;
	let gain = parameters.gain;
	let left = Math.floor(leftChannelParameter[0]);
	let right = Math.floor(rightChannelParameter[0]);


	if(this.isMono)
		output[Math.floor(leftChannelParameter[0])].set(input[0].map(v => v * gain[0]));
	else
	{
		output[left].set(input[0].map(v => v * gain[0]));
		output[right].set(input[1].map(v => v * gain[0]));
		
		// if(left != right + 1)
		// {
			// output[left + 1].set(input[0].map(v => v * gain[0]));
			// output[right - 1].set(input[1].map(v => v * gain[0]));	
		// }
		
	}

    return true;
  }//process
}//panX

registerProcessor('panX', panX);