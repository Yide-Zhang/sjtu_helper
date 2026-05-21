import AsyncStorage from '@react-native-async-storage/async-storage';

const TODOS_KEY = 'CUSTOM_TODOS';

export interface CustomTodo {
  id: string;
  courseName: string;
  title: string;
  dueDate: string | null; // ISO 日期字符串，如 "2026-05-20T14:30"
  completed: boolean;
  createdAt: string; // ISO 字符串
}

let cachedTodos: CustomTodo[] | null = null;

export const getTodos = async (): Promise<CustomTodo[]> => {
  if (cachedTodos) return cachedTodos;
  const str = await AsyncStorage.getItem(TODOS_KEY);
  cachedTodos = str ? JSON.parse(str) : [];
  return cachedTodos;
};

export const saveTodos = async (todos: CustomTodo[]): Promise<void> => {
  cachedTodos = todos;
  await AsyncStorage.setItem(TODOS_KEY, JSON.stringify(todos));
};

export const addTodo = async (courseName: string, title: string, dueDate: string | null): Promise<CustomTodo> => {
  const todos = await getTodos();
  const newTodo: CustomTodo = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    courseName,
    title,
    dueDate,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  await saveTodos([newTodo, ...todos]);
  return newTodo;
};

export const toggleTodo = async (id: string): Promise<CustomTodo[]> => {
  const todos = await getTodos();
  const updated = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  await saveTodos(updated);
  return updated;
};

export const removeTodo = async (id: string): Promise<CustomTodo[]> => {
  const todos = await getTodos();
  const updated = todos.filter(t => t.id !== id);
  await saveTodos(updated);
  return updated;
};
