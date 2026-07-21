const BOX_SIZE = 12;
const BOX_PRICE = 2200;

const flavors = [
  {
    id: 'pomegranate',
    name: 'Гранат',
    description: 'Холодный кофе с натуральным вкусом граната. Глубокий, насыщенный вкус с лёгкой кислинкой.',
    color: '#C41E3A',
    emoji: '🍎',
    image: '/images/flavors/pomegranate.png?v=8',
    topImage: '/images/flavors/top/pomegranate.png?v=11',
  },
  {
    id: 'cornelian',
    name: 'Кизил',
    description: 'Уникальный вкус кизила в сочетании с холодным кофе. Яркий, бодрящий, необычный.',
    color: '#8B0000',
    emoji: '🍒',
    image: '/images/flavors/cornelian.png?v=8',
    topImage: '/images/flavors/top/cornelian.png?v=11',
  },
  {
    id: 'orange',
    name: 'Апельсин',
    description: 'Свежий цитрусовый акцент и мягкий холодный кофе. Идеально для жаркого дня.',
    color: '#FF6B00',
    emoji: '🍊',
    image: '/images/flavors/orange.png?v=8',
    topImage: '/images/flavors/top/orange.png?v=11',
  },
  {
    id: 'cherry',
    name: 'Вишня',
    description: 'Сочная вишня и холодный кофе — классика с характером. Насыщенный бордовый вкус.',
    color: '#9B1B30',
    emoji: '🍒',
    image: '/images/flavors/cherry.png?v=8',
    topImage: '/images/flavors/top/cherry.png?v=11',
  },
  {
    id: 'blackcurrant',
    name: 'Чёрная смородина',
    description: 'Глубокий ягодный вкус с лёгкой терпкостью. Для тех, кто любит насыщенность.',
    color: '#2D1B4E',
    emoji: '🫐',
    image: '/images/flavors/blackcurrant.png?v=8',
    topImage: '/images/flavors/top/blackcurrant.png?v=11',
  },
  {
    id: 'raspberry',
    name: 'Малина',
    description: 'Яркая малина и холодный кофе. Лёгкий, освежающий, с приятным послевкусием.',
    color: '#E0115F',
    emoji: '🍓',
    image: '/images/flavors/raspberry.png?v=8',
    topImage: '/images/flavors/top/raspberry.png?v=11',
  },
];

module.exports = { flavors, BOX_SIZE, BOX_PRICE };
