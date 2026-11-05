import type { Language } from "./contracts";
export type Example = { id: string; title: string; subtitle: string; language: Language; code: string; problem: string; topic: "index" | "condition" | "loop" };
export const examples: Example[] = [
  {
    id: "index", title: "Один шаг за границу", subtitle: "Списки и индексы", language: "python", topic: "index",
    code: 'numbers = [1, 2, 3, 4, 5]\n\n# Выводим каждый элемент списка\nfor i in range(len(numbers) + 1):\n    print(numbers[i])\n',
    problem: "Программа выводит все числа, а затем падает с IndexError: list index out of range. Не понимаю, почему.",
  },
  {
    id: "condition", title: "Условие с подвохом", subtitle: "Логика и границы", language: "javascript", topic: "condition",
    code: 'function canEnter(age) {\n  // Вход разрешён с 18 лет\n  if (age > 18) {\n    return true;\n  }\n  return false;\n}\n\nconsole.log(canEnter(18));\n',
    problem: "Вход должен быть разрешён с 18 лет, но пользователю, которому ровно 18, программа отказывает.",
  },
  {
    id: "loop", title: "Цикл без остановки", subtitle: "Итерации и состояние", language: "python", topic: "loop",
    code: 'count = 0\n\n# Считаем до пяти\nwhile count < 5:\n    print(count)\n    count + 1\n',
    problem: "Ожидаю числа от 0 до 4, но программа бесконечно печатает 0. Почему цикл не заканчивается?",
  },
];
export function findDemoExample(code: string, language: Language) {
  return examples.find(item => item.language === language && item.code.trim() === code.trim());
}
