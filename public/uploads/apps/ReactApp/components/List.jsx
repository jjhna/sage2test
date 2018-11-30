export default function List(props) {
  let values = new Array(10).fill(0).map(i => Math.random() * 10);

  return (values.map(v => (
    <div>
      {v}
    </div>
  )));
}