const assert = require('assert');
const util = require('util');
const Debug = require('debug');

const debug = new Debug('process-repl:eval-instruction');

const portWrite = (port, buffer) => {
	assert(Buffer.isBuffer(buffer));
	// make sure we do not buffer the write
	assert(port.writableHighWaterMark == 0);
	port.write(buffer);
};

const portReadRegisters = (port, { regCount }) => new Promise((resolve, reject) => {
	const bytesRead = [];
	const wordSize = 4;
	const expectedBytes = wordSize * regCount;

	const dataCallback = chunk => {
		assert(Buffer.isBuffer(chunk));
		debug(`read chunk of length: ${chunk.length}`);
		bytesRead.push(...chunk);
		if (bytesRead.length >= expectedBytes) {
			cleanUp();
			port.pause();

			if (bytesRead.length > expectedBytes) {
				debug(`read ${bytesRead.length} bytes, should have been exactly 32`);
				port.unshift(Buffer.from(bytesRead.slice(expectedBytes)));
			}

			const regfile = new Uint32Array(regCount);
			const byteBuffer = Buffer.from(bytesRead, 0, expectedBytes);
			for (let i = 0; i < regCount; ++i) {
				regfile[i] = byteBuffer.readInt32LE(i * wordSize);
			}
			resolve(regfile);
		}
	};

	const errorCallback = error => {
		cleanUp();
		reject(error);
	};

	const endCallback = () => {
		cleanUp();
		reject(new Error('Stream ended before all registers could be read'));
	};

	port.drain(() => {
		port.on('data', dataCallback);
		port.on('error', errorCallback);
		port.on('end', endCallback);
		port.resume();
	});

	function cleanUp() {
		port.removeListener('data', dataCallback);
		port.removeListener('error', errorCallback);
		port.removeListener('end', endCallback);
	};

	// setTimeout(function () {
	// 	cleanUp();
	// 	reject(new Error('Read timed out!'));
	// }, 10000);
});

module.exports = {
	portWrite,
	portReadRegisters
};
