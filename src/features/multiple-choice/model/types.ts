export type MultipleChoiceOption = {
  id: number;
  text: string;
  votes: number;
  color: string;
};

export type MultipleChoiceQuestion = {
  title: string;
  options: MultipleChoiceOption[];
};
