import cron from 'node-cron';
import { exec } from 'child_process';

console.log('Планировщик обновлений запущен...');

// "0 13 * * *" означает: каждый день (все месяцы, все дни недели) ровно в 13:00
cron.schedule('* * * * *', () => {
  console.log(
    `[${new Date().toLocaleTimeString()}] Запуск ежедневного обновления цен...`,
  );

  exec('node parser.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка при запуске парсера: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Ошибка выполнения: ${stderr}`);
      return;
    }
    console.log(`Парсинг успешно завершен:\n${stdout}`);
  });
});
