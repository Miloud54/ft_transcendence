FOR A HIDDEN WORDS :

{
  "type": "word",
  "status": "hidden",
  "length": 8
}

------------

FOR A FOUND WORD :

{
  "type": "word",
  "status": "visible",
  "length": 8,
  "display": "Elephant"
}



export type ArticleTokenType = 'word' | 'separator';

export type ArticleTokenStatus = 'hidden' | 'revealed';

export interface ArticleToken {
  type: ArticleTokenType;
  status?: ArticleTokenStatus;
  length?: number;
  display?: string;
}



ENUMS for 
- type {word, separator}
- status {hidden, revealed, close}

Et dans close : de 1 à 100 ?



EXEMPLE POUR : "Hello" — world!


[
  {
    "type": "separator",
    "display": "\""
  },
  {
    "type": "word",
    "status": "hidden",
    "length": 5
  },
  {
    "type": "separator",
    "display": "\" — "
  },
  {
    "type": "word",
    "status": "hidden",
    "length": 5
  },
  {
    "type": "separator",
    "display": "!"
  }
]


EXEMPLE POUR UN TITRE : The Eiffel Tower

{
  "title": {
    "tokens": [
      {
        "type": "word",
        "status": "hidden",
        "length": 3
      },
      {
        "type": "separator",
        "display": " "
      },
      {
        "type": "word",
        "status": "hidden",
        "length": 6
      },
      {
        "type": "separator",
        "display": " "
      },
      {
        "type": "word",
        "status": "hidden",
        "length": 5
      }
    ]
  }
}



ET LA COMBINAISON TITRE + PARAGRAPHES :

{
  "title": {
    "tokens": [
      {
        "type": "word",
        "status": "hidden",
        "length": 3
      },
      {
        "type": "separator",
        "display": " "
      },
      {
        "type": "word",
        "status": "hidden",
        "length": 6
      }
    ]
  },
  "paragraphs": [
    {
      "tokens": [
        {
          "type": "word",
          "status": "hidden",
          "length": 5
        },
        {
          "type": "separator",
          "display": " "
        },
        {
          "type": "word",
          "status": "hidden",
          "length": 7
        },
        {
          "type": "separator",
          "display": ", "
        },
        {
          "type": "word",
          "status": "hidden",
          "length": 8
        },
        {
          "type": "separator",
          "display": "."
        }
      ]
    }
  ]
}
