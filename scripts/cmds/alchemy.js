const { createCanvas } = require("canvas");

const elementsData = {
    H: { name: "Hydrogen", atomicNumber: 1, atomicWeight: 1.008, color: "#1abc9c" },
    He: { name: "Helium", atomicNumber: 2, atomicWeight: 4.002602, color: "#3498db" },
    Li: { name: "Lithium", atomicNumber: 3, atomicWeight: 6.94, color: "#9b59b6" },
    Be: { name: "Beryllium", atomicNumber: 4, atomicWeight: 9.0121831, color: "#e74c3c" },
    B: { name: "Boron", atomicNumber: 5, atomicWeight: 10.81, color: "#f1c40f" },
    C: { name: "Carbon", atomicNumber: 6, atomicWeight: 12.011, color: "#ecf0f1" },
    N: { name: "Nitrogen", atomicNumber: 7, atomicWeight: 14.007, color: "#95a5a6" },
    O: { name: "Oxygen", atomicNumber: 8, atomicWeight: 15.999, color: "#34495e" },
    F: { name: "Fluorine", atomicNumber: 9, atomicWeight: 18.998403163, color: "#16a085" },
    Ne: { name: "Neon", atomicNumber: 10, atomicWeight: 20.1797, color: "#27ae60" },
    Na: { name: "Sodium", atomicNumber: 11, atomicWeight: 22.98976928, color: "#2980b9" },
    Mg: { name: "Magnesium", atomicNumber: 12, atomicWeight: 24.305, color: "#8e44ad" },
    Al: { name: "Aluminum", atomicNumber: 13, atomicWeight: 26.9815385, color: "#c0392b" },
    Si: { name: "Silicon", atomicNumber: 14, atomicWeight: 28.085, color: "#f39c12" },
    P: { name: "Phosphorus", atomicNumber: 15, atomicWeight: 30.973761998, color: "#d35400" },
    S: { name: "Sulfur", atomicNumber: 16, atomicWeight: 32.06, color: "#fded43" },
    Cl: { name: "Chlorine", atomicNumber: 17, atomicWeight: 35.45, color: "#26c281" },
    Ar: { name: "Argon", atomicNumber: 18, atomicWeight: 39.948, color: "#6dd5ed" },
    K: { name: "Potassium", atomicNumber: 19, atomicWeight: 39.0983, color: "#9b59b6" },
    Ca: { name: "Calcium", atomicNumber: 20, atomicWeight: 40.078, color: "#2980b9" },
    Sc: { name: "Scandium", atomicNumber: 21, atomicWeight: 44.955908, color: "#1abc9c" },
    Ti: { name: "Titanium", atomicNumber: 22, atomicWeight: 47.867, color: "#3498db" },
    V: { name: "Vanadium", atomicNumber: 23, atomicWeight: 50.9415, color: "#9b59b6" },
    Cr: { name: "Chromium", atomicNumber: 24, atomicWeight: 51.9961, color: "#e74c3c" },
    Mn: { name: "Manganese", atomicNumber: 25, atomicWeight: 54.938044, color: "#f1c40f" },
    Fe: { name: "Iron", atomicNumber: 26, atomicWeight: 55.845, color: "#e67e22" },
    Co: { name: "Cobalt", atomicNumber: 27, atomicWeight: 58.933194, color: "#1abc9c" },
    Ni: { name: "Nickel", atomicNumber: 28, atomicWeight: 58.6934, color: "#3498db" },
    Cu: { name: "Copper", atomicNumber: 29, atomicWeight: 63.546, color: "#9b59b6" },
    Zn: { name: "Zinc", atomicNumber: 30, atomicWeight: 65.38, color: "#e74c3c" },
    Ga: { name: "Gallium", atomicNumber: 31, atomicWeight: 69.723, color: "#f1c40f" },
    Ge: { name: "Germanium", atomicNumber: 32, atomicWeight: 72.63, color: "#e67e22" },
    As: { name: "Arsenic", atomicNumber: 33, atomicWeight: 74.921595, color: "#1abc9c" },
    Se: { name: "Selenium", atomicNumber: 34, atomicWeight: 78.971, color: "#3498db" },
    Br: { name: "Bromine", atomicNumber: 35, atomicWeight: 79.904, color: "#9b59b6" },
    Kr: { name: "Krypton", atomicNumber: 36, atomicWeight: 83.798, color: "#e74c3c" },
    Rb: { name: "Rubidium", atomicNumber: 37, atomicWeight: 85.4678, color: "#f1c40f" },
    Sr: { name: "Strontium", atomicNumber: 38, atomicWeight: 87.62, color: "#e67e22" },
    Y: { name: "Yttrium", atomicNumber: 39, atomicWeight: 88.90584, color: "#1abc9c" },
    Zr: { name: "Zirconium", atomicNumber: 40, atomicWeight: 91.224, color: "#3498db" },
    Nb: { name: "Niobium", atomicNumber: 41, atomicWeight: 92.90637, color: "#9b59b6" },
    Mo: { name: "Molybdenum", atomicNumber: 42, atomicWeight: 95.95, color: "#e74c3c" },
    Tc: { name: "Technetium", atomicNumber: 43, atomicWeight: 98, color: "#f1c40f" },
    Ru: { name: "Ruthenium", atomicNumber: 44, atomicWeight: 101.07, color: "#e67e22" },
    Rh: { name: "Rhodium", atomicNumber: 45, atomicWeight: 102.9055, color: "#1abc9c" },
    Pd: { name: "Palladium", atomicNumber: 46, atomicWeight: 106.42, color: "#3498db" },
    Ag: { name: "Silver", atomicNumber: 47, atomicWeight: 107.8682, color: "#9b59b6" },
    Cd: { name: "Cadmium", atomicNumber: 48, atomicWeight: 112.414, color: "#e74c3c" },
    In: { name: "Indium", atomicNumber: 49, atomicWeight: 114.818, color: "#f1c40f" },
    Sn: { name: "Tin", atomicNumber: 50, atomicWeight: 118.71, color: "#e67e22" },
    Sb: { name: "Antimony", atomicNumber: 51, atomicWeight: 121.76, color: "#1abc9c" },
    Te: { name: "Tellurium", atomicNumber: 52, atomicWeight: 127.6, color: "#3498db" },
    I: { name: "Iodine", atomicNumber: 53, atomicWeight: 126.90447, color: "#9400D3" },
    Xe: { name: "Xenon", atomicNumber: 54, atomicWeight: 131.293, color: "#f39c12" },
    Cs: { name: "Cesium", atomicNumber: 55, atomicWeight: 132.90545196, color: "#5F9EA0" },
    Ba: { name: "Barium", atomicNumber: 56, atomicWeight: 137.327, color: "#483D8B" },
    La: { name: "Lanthanum", atomicNumber: 57, atomicWeight: 138.90547, color: "#2ecc71" },
    Ce: { name: "Cerium", atomicNumber: 58, atomicWeight: 140.116, color: "#e91e63" },
    Pr: { name: "Praseodymium", atomicNumber: 59, atomicWeight: 140.90766, color: "#673ab7" },
    Nd: { name: "Neodymium", atomicNumber: 60, atomicWeight: 144.242, color: "#3f51b5" },
    Pm: { name: "Promethium", atomicNumber: 61, atomicWeight: 145, color: "#03a9f4" },
    Sm: { name: "Samarium", atomicNumber: 62, atomicWeight: 150.36, color: "#00bcd4" },
    Eu: { name: "Europium", atomicNumber: 63, atomicWeight: 151.964, color: "#009688" },
    Gd: { name: "Gadolinium", atomicNumber: 64, atomicWeight: 157.25, color: "#4caf50" },
    Tb: { name: "Terbium", atomicNumber: 65, atomicWeight: 158.92535, color: "#8bc34a" },
    Dy: { name: "Dysprosium", atomicNumber: 66, atomicWeight: 162.5, color: "#cddc39" },
    Ho: { name: "Holmium", atomicNumber: 67, atomicWeight: 164.93033, color: "#ffeb3b" },
    Er: { name: "Erbium", atomicNumber: 68, atomicWeight: 167.259, color: "#ffc107" },
    Tm: { name: "Thulium", atomicNumber: 69, atomicWeight: 168.93422, color: "#ff9800" },
    Yb: { name: "Ytterbium", atomicNumber: 70, atomicWeight: 173.045, color: "#ff5722" },
    Lu: { name: "Lutetium", atomicNumber: 71, atomicWeight: 174.9668, color: "#795548" },
    Hf: { name: "Hafnium", atomicNumber: 72, atomicWeight: 178.49, color: "#607d8b" },
    Ta: { name: "Tantalum", atomicNumber: 73, atomicWeight: 180.94788, color: "#9e9e9e" },
    W: { name: "Tungsten", atomicNumber: 74, atomicWeight: 183.84, color: "#bdbdbd" },
    Re: { name: "Rhenium", atomicNumber: 75, atomicWeight: 186.207, color: "#64ffda" },
    Os: { name: "Osmium", atomicNumber: 76, atomicWeight: 190.23, color: "#a1887f" },
    Ir: { name: "Iridium", atomicNumber: 77, atomicWeight: 192.217, color: "#00e676" },
    Pt: { name: "Platinum", atomicNumber: 78, atomicWeight: 195.084, color: "#00c853" },
    Au: { name: "Gold", atomicNumber: 79, atomicWeight: 196.966569, color: "#FFD700" },
    Hg: { name: "Mercury", atomicNumber: 80, atomicWeight: 200.592, color: "#808080" },
    Tl: { name: "Thallium", atomicNumber: 81, atomicWeight: 204.3833, color: "#f06292" },
    Pb: { name: "Lead", atomicNumber: 82, atomicWeight: 207.2, color: "#ba68c8" },
    Bi: { name: "Bismuth", atomicNumber: 83, atomicWeight: 208.9804, color: "#9575cd" },
    Po: { name: "Polonium", atomicNumber: 84, atomicWeight: 209, color: "#7e57c2" },
    At: { name: "Astatine", atomicNumber: 85, atomicWeight: 210, color: "#673ab7" },
    Rn: { name: "Radon", atomicNumber: 86, atomicWeight: 222, color: "#5e35b1" },
    Fr: { name: "Francium", atomicNumber: 87, atomicWeight: 223, color: "#512da8" },
    Ra: { name: "Radium", atomicNumber: 88, atomicWeight: 226, color: "#4527a0" },
    Ac: { name: "Actinium", atomicNumber: 89, atomicWeight: 227, color: "#311b92" },
    Th: { name: "Thorium", atomicNumber: 90, atomicWeight: 232.03806, color: "#1a237e" },
    Pa: { name: "Protactinium", atomicNumber: 91, atomicWeight: 231.03588, color: "#283593" },
    U: { name: "Uranium", atomicNumber: 92, atomicWeight: 238.02891, color: "#303f9f" },
    Np: { name: "Neptunium", atomicNumber: 93, atomicWeight: 237, color: "#3949ab" },
    Pu: { name: "Plutonium", atomicNumber: 94, atomicWeight: 244, color: "#3f51b5" },
    Am: { name: "Americium", atomicNumber: 95, atomicWeight: 243, color: "#5c6bc0" },
    Cm: { name: "Curium", atomicNumber: 96, atomicWeight: 247, color: "#673ab7" },
    Bk: { name: "Berkelium", atomicNumber: 97, atomicWeight: 247, color: "#7e57c2" },
    Cf: { name: "Californium", atomicNumber: 98, atomicWeight: 251, color: "#9575cd" },
    Es: { name: "Einsteinium", atomicNumber: 99, atomicWeight: 252, color: "#ba68c8" },
    Fm: { name: "Fermium", atomicNumber: 100, atomicWeight: 257, color: "#f06292" },
    Md: { name: "Mendelevium", atomicNumber: 101, atomicWeight: 258, color: "#e57373" },
    No: { name: "Nobelium", atomicNumber: 102, atomicWeight: 259, color: "#ef5350" },
    Lr: { name: "Lawrencium", atomicNumber: 103, atomicWeight: 266, color: "#f44336" },
    Rf: { name: "Rutherfordium", atomicNumber: 104, atomicWeight: 267, color: "#e53935" },
    Db: { name: "Dubnium", atomicNumber: 105, atomicWeight: 268, color: "#d32f2f" },
    Sg: { name: "Seaborgium", atomicNumber: 106, atomicWeight: 269, color: "#c62828" },
    Bh: { name: "Bohrium", atomicNumber: 107, atomicWeight: 270, color: "#b71c1c" },
    Hs: { name: "Hassium", atomicNumber: 108, atomicWeight: 277, color: "#4db6ac" },
    Mt: { name: "Meitnerium", atomicNumber: 109, atomicWeight: 278, color: "#4dd0e1" },
    Ds: { name: "Darmstadtium", atomicNumber: 110, atomicWeight: 281, color: "#4fc3f7" },
    Rg: { name: "Roentgenium", atomicNumber: 111, atomicWeight: 282, color: "#64b5f6" },
    Cn: { name: "Copernicium", atomicNumber: 112, atomicWeight: 285, color: "#7986cb" },
    Nh: { name: "Nihonium", atomicNumber: 113, atomicWeight: 286, color: "#90a4ae" },
    Fl: { name: "Flerovium", atomicNumber: 114, atomicWeight: 289, color: "#a1887f" },
    Mc: { name: "Moscovium", atomicNumber: 115, atomicWeight: 290, color: "#aed581" },
    Lv: { name: "Livermorium", atomicNumber: 116, atomicWeight: 293, color: "#fff59d" },
    Ts: { name: "Tennessine", atomicNumber: 117, atomicWeight: 294, color: "#ffab91" },
    Og: { name: "Oganesson", atomicNumber: 118, atomicWeight: 294, color: "#DDA0DD" },
};


const elements = Object.keys(elementsData);

function categorizeByFirstLetter(words) {
    const categorizedWords = {};
    words.forEach(word => {
        const firstLetter = word.charAt(0).toLowerCase();
        if (!categorizedWords[firstLetter]) categorizedWords[firstLetter] = [];
        categorizedWords[firstLetter].push(word);
    });
    return categorizedWords;
}

function processText(inputText, wordList) {
    const lowerCaseWords = wordList.map(word => word.toLowerCase());
    const categorizedWords = categorizeByFirstLetter(wordList);
    inputText = inputText.toLowerCase();
    const result = [];
    let index = 0;

    while (index < inputText.length) {
        if (inputText[index] === " ") {
            result.push(" ");
            index += 1;
        } else {
            const currentChar = inputText[index];
            if (index < inputText.length - 1 && lowerCaseWords.includes(inputText.substring(index, index + 2))) {
                result.push(inputText.substring(index, index + 2));
                index += 2;
            } else if (lowerCaseWords.includes(currentChar)) {
                result.push(currentChar);
                index += 1;
            } else {
                if (categorizedWords[currentChar] && categorizedWords[currentChar].length > 0) {
                    const randomWordIndex = Math.floor(Math.random() * categorizedWords[currentChar].length);
                    result.push(`(${categorizedWords[currentChar][randomWordIndex]})`);
                }
                index += 1;
            }
        }
    }
    return result.map(word => word === " " ? " " : word.charAt(0).toUpperCase() + word.slice(1));
}

function drawElement(context, elementText, xPosition, yPosition) {
    const elementSize = 120;
    const isWrapped = elementText.startsWith('(') && elementText.endsWith(')');
    const processedText = isWrapped ? elementText.slice(1, -1) : elementText;
    const lookupKey = processedText.charAt(0).toUpperCase() + processedText.slice(1).toLowerCase();
    const elementData = elementsData[lookupKey] || elementsData[processedText] || { name: "Unknown", atomicNumber: '?', atomicWeight: '?.???', color: "#FFB7CE" };

    context.beginPath();
    context.roundRect(xPosition, yPosition, elementSize, elementSize, 10);
    context.fillStyle = elementData.color;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#000";
    context.stroke();

    context.textAlign = "center";
    context.fillStyle = "#000";
    context.font = "bold 48px Arial";
    context.fillText(processedText, xPosition + elementSize / 2, yPosition + elementSize / 2 + 15);

    if (elementData.atomicNumber !== '?' && elementData.atomicNumber !== 0) {
        context.font = "bold 16px Arial";
        context.textAlign = "left";
        context.fillText(elementData.atomicNumber.toString(), xPosition + 8, yPosition + 22);
    }

    if (elementData.name && elementData.name !== "Unknown") {
        context.font = "14px Arial";
        context.textAlign = "center";
        context.fillText(elementData.name, xPosition + elementSize / 2, yPosition + elementSize - 30);
        if (elementData.atomicWeight !== '?.???') {
            context.fillText(typeof elementData.atomicWeight === 'number' ? elementData.atomicWeight.toFixed(3) : elementData.atomicWeight, xPosition + elementSize / 2, yPosition + elementSize - 10);
        }
    }
}

// GoatBot command structure
module.exports = {
    config: {
        name: "alchemy",
        version: "1.0",
        author: "Samir X Adrita",
        countDown: 10,
        role: 0,
        description: {
            vi: "Biến chữ thành các nguyên tố hóa học và tạo ảnh",
            en: "Turns text into chemical elements and generates an image"
        },
        category: "Fun",
        guide: {
            vi: "{pn} <text>: Biến chữ thành các nguyên tố hóa học",
            en: "{pn} <text>: Turns text into chemical elements"
        }
    },

    langs: {
        vi: {
            noText: "⚠️ | Vui lòng nhập nội dung để alchemize! Usage: {pn} <text>",
            processing: "🧪 Đang alchemize chữ...",
            error: "😥 Đã xảy ra lỗi khi alchemize chữ."
        },
        en: {
            noText: "⚠️ | Please provide some text to alchemize! Usage: {pn} <text>",
            processing: "🧪 Alchemizing your text...",
            error: "😥 Oops! Something went wrong while alchemizing."
        }
    },

    onStart: async function({ message, args, getLang }) {
        const inputText = args.join(" ");
        if (!inputText) return message.reply(getLang("noText"));

        try {
            await message.reply(getLang("processing"));

            const processedTextArray = processText(inputText, elements);
            if (processedTextArray.length === 0 || processedTextArray.every(word => word === " ")) {
                return message.reply(getLang("error"));
            }

            const elementSize = 120;
            const spacing = 9.5;
            const spaceWidth = spacing + 15;

            const elementCount = processedTextArray.filter(w => w !== " ").length;
            const spaceCount = processedTextArray.filter(w => w === " ").length;
            const totalWidth = (elementCount * elementSize) + ((elementCount - 1) * spacing) + (spaceCount * spaceWidth);
            const canvasWidth = Math.max(300, totalWidth + 100); // padding
            const canvasHeight = elementSize + 100;

            const canvas = createCanvas(canvasWidth, canvasHeight);
            const context = canvas.getContext("2d");
            context.fillStyle = "#E0E0E0";
            context.fillRect(0, 0, canvasWidth, canvasHeight);

            let currentX = (canvasWidth - totalWidth) / 2;
            const centerY = (canvasHeight - elementSize) / 2;

            processedTextArray.forEach(word => {
                if (word === " ") currentX += spaceWidth;
                else {
                    drawElement(context, word, currentX, centerY);
                    currentX += elementSize + spacing;
                }
            });

            const buffer = canvas.toBuffer("image/png");
            await message.reply({ attachment: buffer });

        } catch (error) {
            console.error(error);
            await message.reply(getLang("error"));
        }
    }
};

if (typeof CanvasRenderingContext2D !== 'undefined' && typeof CanvasRenderingContext2D.prototype.roundRect === 'undefined') {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2*r) r = w/2;
        if (h < 2*r) r = h/2;
        this.beginPath();
        this.moveTo(x+r, y);
        this.arcTo(x+w, y,   x+w, y+h, r);
        this.arcTo(x+w, y+h, x,   y+h, r);
        this.arcTo(x,   y+h, x,   y,   r);
        this.arcTo(x,   y,   x+w, y,   r);
        this.closePath();
        return this;
    }
}
