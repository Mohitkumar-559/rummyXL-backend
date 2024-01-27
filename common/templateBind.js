const handlebars = require("handlebars");

function renderMessageFromTemplateAndVariables(templateData, variablesData) {
    return handlebars.compile(templateData)(variablesData);
}
function calculateInvoiceData(winningAmount, bootValue, state, commission, bonus) {
    let data = {};
    let amount = 0;
    if (winningAmount) {
        amount = Number(winningAmount);
        bonus = winningAmount * Number(bonus) / 100;
    } else {
        amount = Number(bootValue);
        if (commission > 0) {
            amount = Number(bootValue) * Number(commission) / 100;
        }
        bonus = bootValue * Number(bonus) / 100;
    }


    let grossAmount = (amount / 1.18);
    let discount = (bonus / 1.18);
    let taxableAmount = grossAmount - discount;
    data.taxableAmount = roundToTwo(taxableAmount);
    data.grossTaxableAmount = roundToTwo(grossAmount);
    if (state !== "Haryana") {
        let igst = taxableAmount * 18 / 100;
        data.igst = roundToTwo(igst);
        data.cgst = 0;
        data.sgst = 0;


    } else {
        let sgst = taxableAmount * 9 / 100;
        let cgst = taxableAmount * 9 / 100;
        data.sgst = roundToTwo(sgst);
        data.cgst = roundToTwo(cgst);
    }
    data.totalAmount = roundToTwo(amount - bonus);
    data.discount = roundToTwo(discount);
    data.roundOff = "0.00";
    return data;
}

function roundToTwo(num) {
    return +(Math.round(num + "e+2") + "e-2");
}

function inWords(num) {
    let a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    let b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    num = num.toString();
    // if ((num = num.toString()).length > 9) return 'overflow';
    if (num.length > 9) return 'overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);


    if (!n) return;
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? '' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + '' : '';
    return str;
}

module.exports = { renderMessageFromTemplateAndVariables, calculateInvoiceData, inWords };