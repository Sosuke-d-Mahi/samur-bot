module.exports = {
  config: {
    name: "bmi",
    version: "1.0",
    author: "Samir",
    countDown: 5,
    role: 0,
    shortDescription: "Calculate BMI",
    longDescription: "Calculate your BMI based on weight and height (ft + inches)",
    category: "utility",
    guide: {
      en: "{pn} <weight_kg> <feet> <inches>\nExample: {pn} 90 6 4"
    }
  },

  onStart: async function ({ message, args }) {
    if (args.length < 3)
      return message.reply("Please provide weight (kg), feet, and inches.\nExample: bmi 90 6 4");

    const [weightStr, feetStr, inchStr] = args;
    const weight = parseFloat(weightStr);
    const feet = parseFloat(feetStr);
    const inches = parseFloat(inchStr);

    if (isNaN(weight) || isNaN(feet) || isNaN(inches))
      return message.reply("Invalid input. Make sure all values are numbers.");

    const heightMeters = ((feet * 12 + inches) * 2.54) / 100;
    const bmi = weight / (heightMeters * heightMeters);
    const roundedBMI = bmi.toFixed(1);

    let status = "";
    if (bmi < 18.5) status = "Underweight";
    else if (bmi < 25) status = "Normal";
    else if (bmi < 30) status = "Overweight";
    else status = "Obese";

    message.reply(`Your BMI is ${roundedBMI} (${status})`);
  }
};