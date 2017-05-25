// NodeJS script.
// Резервное копирование БД 1С
// ===========================
// version: 1.1.1
// ===========================
'use strict';

const fs = require('fs');
const fileDataSettings = require('./filedata.private.js');
const transportSettings = require('./email.private.js');
const mailerLocalPathSettings = require('./localmailer.private.js');
const nodemailer = require(mailerLocalPathSettings.path);

let listOfDumpFiles;
let listOfReservFiles;
let statOfDumpFile;
let dumpLength; 
let FIVE_DAYS = 432000000; // Количество милисекунд в 5 днях
let ONE_DAY  =  86400000; // Количество милисекунд в 1 дне
let DATE_NOW =  Date.now(); // Текущее время запуска скипта
let strDateNow = new Date(DATE_NOW);
let parseFileBirth; // распарсенное время создания файла дампа
let EXCLUDE_FILE_NAME = 'rezerv1Cbuh.bat'; // Файл который не нужно удалять
let isPrintLogs = true; // нужен дебагЛог или нет!

/**
 * Транспорт для возможности отправки электронной почты
 */
let transporter = nodemailer.createTransport(transportSettings);

/**
 * Заготовка письма для отправки
 */
let mailOptions = {
    from: '"Backup NODEJS Service" <twinpix@yandex.ru>', // sender address
    to: 'taksenov@gmail.com', // list of receivers
    subject: 'Test', // Subject line
    text: 'TEST BACKUP', // plain text body
    html: '<p>TEST BACKUP</p>' // html body
};

/**
 * Отправка сообщени по электронной почте
 * localMailOptions -- заготовка письма для отправки из функции
 */
function sendEmail(localMailOptions) {
	transporter.sendMail(localMailOptions, (error, info) => {
		if (error) {
			if (isPrintLogs) console.log(error);
			return;
		}
		if (isPrintLogs) console.log('Message %s sent: %s', info.messageId, info.response);
	});
}
// sendEmail

// Прочитать список файлов в каталоге DUMP_PATH
try {
	listOfDumpFiles = fs.readdirSync(fileDataSettings.DUMP_PATH);
} catch (err) {
	if (isPrintLogs) console.log('DUMP_PATH Error is', err);
	/**
	 * Отправка почты
	 * @param  {[type]} mailOptions письмо
	 * @param  {[type]} (error,     info          [description]
	 * @return {[type]}             [description]
	 */
	mailOptions.subject = '1С-Backup DUMP_PATH Error';
	mailOptions.text = 'DUMP_PATH Error is ' + err;
	mailOptions.html = '<p>DUMP_PATH Error is ' + err + '</p>';
	sendEmail(mailOptions);
	process.exit();
}

// Прочитать список файлов в каталоге DUMP_PATH
try {
	listOfReservFiles = fs.readdirSync(fileDataSettings.RESERV_PATH);
} catch (err) {
	if (isPrintLogs) console.log('RESERV_PATH Error is', err);
	/**
	 * Отправка почты
	 * @param  {[type]} mailOptions письмо
	 * @param  {[type]} (error,     info          [description]
	 * @return {[type]}             [description]
	 */
	mailOptions.subject = '1С-Backup RESERV_PATH Error';
	mailOptions.text = 'RESERV_PATH Error is ' + err;
	mailOptions.html = '<p>RESERV_PATH Error is ' + err + '</p>';	
	sendEmail(mailOptions);
	process.exit();
}

dumpLength = listOfDumpFiles.length;

/**
 * обработать все файлы в каталоге DUMP_PATH
 * скопировать имя файла, дата создания которого равнасегодняшнему дню
 * удалить все файлы старше 5 суток
 */
for ( let currentFileName of listOfDumpFiles ) {

	// Прочитать свойства файлов в каталоге DUMP_PATH
	try {
		statOfDumpFile = fs.statSync(fileDataSettings.DUMP_PATH+currentFileName);  // statSync(path)
	} catch (err) {
		if (isPrintLogs) console.log('statSync Error is', err);
		/**
		 * Отправка почты
		 * @param  {[type]} mailOptions письмо
		 * @param  {[type]} (error,     info          [description]
		 * @return {[type]}             [description]
		 */
		mailOptions.subject = '1С-Backup statSync Error';
		mailOptions.text = 'statSync Error is ' + err;
		mailOptions.html = '<p>statSync Error is ' + err + '</p>';		
		sendEmail(mailOptions);
		process.exit();
	}

	// Работать только с файлами, каталоги пропускать
	if (!statOfDumpFile.isFile()) {
		continue;
	} 

	parseFileBirth = Date.parse(statOfDumpFile.ctime);

	// Если файл старше 70 дней, то удалить его из каталога
	if ( parseFileBirth < ( DATE_NOW - (ONE_DAY * 70) ) ) {
		//Дополнительная проверка, чтоб не удалить батник
		if ( currentFileName !== EXCLUDE_FILE_NAME ) {
			fs.unlinkSync(fileDataSettings.DUMP_PATH+currentFileName);
			if (isPrintLogs) console.log('Файл удаляю ', currentFileName);
			continue;
		} else {
			if (isPrintLogs) console.log('Файл НЕ удаляю ', currentFileName);
			continue;
		}
	}

	// Если есть файлы которых нет в каталоге резерва, то скопировать их туда
	let dateToday = new Date();
	if ( listOfReservFiles.indexOf(currentFileName) === -1 ) {
			let copiedFile = fs.createReadStream(fileDataSettings.DUMP_PATH+currentFileName);
			let bytesCopied = 0;
			let fileSize = statOfDumpFile.size;

			copiedFile.on('data', function(buffer){
				bytesCopied+= buffer.length
				let porcentage = ((bytesCopied/fileSize)*100).toFixed(2)
				if (isPrintLogs) console.log(porcentage+'%') 
			})

			copiedFile.on('end', function(){
				/**
				 * Отправка почты
				 * @param  {[type]} mailOptions письмо
				 * @param  {[type]} (error,     info          [description]
				 * @return {[type]}             [description]
				 */
				mailOptions.subject = '1С-Backup sucess';
				mailOptions.text = 'Copy of ' + currentFileName + ' to RESERV_PATH sucess. Date: ' + strDateNow;
				mailOptions.html = '<p>Copy of ' + currentFileName + ' to RESERV_PATH sucess. Date: ' + strDateNow + '</p>';			
				sendEmail(mailOptions);
				if (isPrintLogs) console.log( `Copy of ${currentFileName} to RESERV_PATH sucess` );	
			})

			copiedFile.pipe(
				fs.createWriteStream(fileDataSettings.RESERV_PATH+currentFileName)
			);
		}
}

