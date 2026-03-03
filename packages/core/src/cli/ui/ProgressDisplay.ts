import chalk from 'chalk';

export function header(title: string): void {
  console.log();
  console.log(chalk.bold(`\u2726 ${title}`));
  console.log(chalk.dim(`  ${'─'.repeat(50)}`));
}

export function subheader(title: string): void {
  console.log();
  console.log(chalk.bold(`  ${title}`));
}

export function info(message: string): void {
  console.log(`  ${chalk.cyan('ℹ')} ${message}`);
}

export function success(message: string): void {
  console.log(`  ${chalk.green('✓')} ${message}`);
}

export function error(message: string): void {
  console.error(`  ${chalk.red('✗')} ${message}`);
}

export function warn(message: string): void {
  console.log(`  ${chalk.yellow('!')} ${message}`);
}

export function listItem(label: string, value: string): void {
  console.log(`    ${chalk.cyan(label)}  ${chalk.dim(value)}`);
}

export function blank(): void {
  console.log();
}
