// Given array of μ-law and Base64 encoded PCM strings
const encodedArray = [
    "/Pv8//7+fv19/H7x29TN3mFpW1deXmRdWmRqZe3Y3tnd2eNtaE1bVklPPz5HQ1Xp69HKwr3Bvr/Dx+vl7ExNRDtFRUp4bObRy8LBzNTU5+z//m9V7OZv5ezo7//m5P/p/k1cUENISk9CR/5XUdHDxMe9tcHIyF5JREBBPkFDS+3ezcfFwcTBxsDQva2vtT8vJA4KCggICwwNDhQfK32tlw==",
    "iIOCgICBgYOEiIySnK3CzW1BLx8YEAoGBAMGCQsNDhMZIDPesKWgnJmXlZWWlpeZmpqcnqClqKyzub3J09vyX0xAOzk0MC8uLy8wMjM2Nz1MWOfNx8HFw7y+vru7u766trzBx8XEycXE0/9jTkhCPjw4NjUzMzQzMzIzNjc6PD5BPj0+Ozo7Oz08PkdKUF/t0dPWzdLa09DP0NLP1drRzQ==",
    "zs7S2ehcTkhESUlLT1FQS0xQUVdXVV9VUlhNTlNaWV/b0c3HwsHFxMC7ur26t7OvraqoqKiorK6yucPbXT4zLiwrLS80ODo8Oj08NTQzNTM0OTo6P0hGUkw+REJHPDM+QEvlz7u8vrGtrqWalZeen6hSMy8pIyIzTlLAq6u2uLfVQjw4MS4zPkJKdtvWa2X8WUpLbG9p1snPz97Tu7u2rg==",
    "nIyPn5aiKxkPEw8NFyk3Mrmjss++wjorKzUlHC0+NkPNsrxkubRXTubiWVHJu8THu7rX1rSzt62Wh5Kpj6MiGxQbEg8gZFxQpZ2yXbzTLCkpNCweNu47V/PGwT1ryUlLWd3VQui939zVwNVuyr67u56Mj6+ZnS8fGSIbESHuWlGupa5VzsQwKSsyLyc54z1FZWbmPkzXS1j/1dhwwcDI1Q=="
  ];
  
  // Decode Base64 strings and combine them into a single binary string
  const combinedBinaryString = encodedArray.reduce((acc, encodedStr) => {
    const decodedData = Buffer.from(encodedStr, 'base64').toString('binary');
    return acc + decodedData;
  }, '');
  
  // Convert μ-law data to 8-bit PCM
  function decodeMuLaw(muLawData) {
    const pcmData = new Int8Array(muLawData.length);
    for (let i = 0; i < muLawData.length; i++) {
      const muLawByte = muLawData.charCodeAt(i);
      pcmData[i] = decodeMuLawByte(muLawByte);
    }
    return pcmData;
  }
  
  function decodeMuLawByte(byte) {
    const sign = (byte & 0x80) === 0 ? 1 : -1;
    const position = (byte & 0x7F) + 0.5;
    const decoded = sign * ((1 << (position & 0x0F)) - 1 + ((position >> 4) & 0x0F) * 32);
    return Math.round(decoded);
  }
  
  // Decode the combined μ-law binary string to PCM
  const pcmArray = decodeMuLaw(combinedBinaryString);
  
  // Output the 8-bit PCM array
  console.log(pcmArray);
  