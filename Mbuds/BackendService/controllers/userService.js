
exports.getUserDashboard = (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Ok reporting"
    })
}
exports.postbluetoothdata = (req, res, next) => {
    const  data  = req.body;

    if(typeof(data)===undefined){
        return res.status(500).json({
            message:'Interval server error'
        })
    }
    console.log(typeof(data));
    console.log(`This is the data recieved ${JSON.stringify(data)}`);
    try {
        console.log('No errors');
        return res.status(200).json({
            message: 'Data recieved'
        })
    }
    catch (error) {
        console.error(error);
        return res.status(404).json({
            message: 'Resource not found'
        })
    }
}






