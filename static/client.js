const socket =io;

const cache = new Map();


// real time stock info 
socket.io("state:init", ({ symbols }) => {
    for (const s of symbols){
        if(!cache.has(s)) cache.set(s,{
            price: null,
            ts: null
        });
    }
   render();
});


socket.on("price:update", ({symbol, price, ts}) =>{

})


